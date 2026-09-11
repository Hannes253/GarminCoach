import "server-only";
import {
  computeRollingLoad,
  computeWeeklyVolume,
  defaultTrainingScienceConfig,
  reconcileWorkouts,
  runAdaptationEngine,
  type Activity,
  type TrainingPlan,
} from "@garmincoach/training-engine";
import {
  planAdjustmentToInsert,
  planPhaseToInsert,
  plannedWorkoutToInsert,
  planWeekToInsert,
  rowToPlanAdjustment,
  rowToPlannedWorkout,
  rowToPlanPhase,
  rowToPlanWeek,
  trainingPlanToInsert,
} from "@/lib/mappers/plan";
import { createClient } from "@/lib/supabase/server";

/** Average weekly running volume over the last few weeks with runs - mirrors lib/actions/plan.ts's estimate. */
function estimateCurrentWeeklyVolumeKm(weeklyVolume: ReturnType<typeof computeWeeklyVolume>): number {
  const recentWeeks = weeklyVolume.slice(-3);
  if (recentWeeks.length === 0) return 0;
  return recentWeeks.reduce((sum, w) => sum + w.distanceKm, 0) / recentWeeks.length;
}

/**
 * Runs the adaptation engine once, lazily - called from the Home page on
 * every open, there is no cron/scheduling in v1. Reconciles planned_workouts
 * against real activities, then lets the engine decide whether to reorder a
 * missed session, reduce a week's volume, regenerate the whole plan after a
 * long break, or insert a recovery week - and persists whatever it decides.
 * No-ops entirely (and cheaply, after a handful of reads) if there's no
 * active plan or nothing to do. Errors are logged rather than thrown so a
 * transient DB hiccup here never breaks the Home page itself.
 */
export async function runLazyAdaptation(activities: Activity[]): Promise<void> {
  try {
    await runLazyAdaptationUnsafe(activities);
  } catch (error) {
    console.error("runLazyAdaptation failed:", error);
  }
}

async function runLazyAdaptationUnsafe(activities: Activity[]): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: planRow } = await supabase
    .from("training_plans")
    .select("id, race_date, status, generation_reason, superseded_by_plan_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!planRow) return;

  const { data: phaseRows } = await supabase
    .from("plan_phases")
    .select("id, phase_type, start_date, end_date, sequence_order, target_weekly_volume_km")
    .eq("plan_id", planRow.id);
  const phases = (phaseRows ?? []).map(rowToPlanPhase);
  if (phases.length === 0) return;

  const phaseIds = phases.map((p) => p.id);
  const { data: weekRows } = await supabase
    .from("plan_weeks")
    .select("id, phase_id, week_start_date, week_number, is_deload, target_volume_km, target_long_run_km, status")
    .in("phase_id", phaseIds);
  const weeks = (weekRows ?? []).map(rowToPlanWeek);
  if (weeks.length === 0) return;

  const weekIds = weeks.map((w) => w.id);
  const { data: workoutRows } = await supabase
    .from("planned_workouts")
    .select(
      "id, plan_week_id, date, sequence_in_week, workout_type, target_distance_km, target_duration_minutes, target_pace_range, target_hr_zone, status, completed_activity_id",
    )
    .in("plan_week_id", weekIds);
  const workouts = (workoutRows ?? []).map(rowToPlannedWorkout);

  const { data: adjustmentRows } = await supabase
    .from("plan_adjustments")
    .select("id, plan_id, triggered_at, trigger_type, trigger_context, rule_applied, rationale_text, affected_week_ids")
    .eq("plan_id", planRow.id);
  const existingAdjustments = (adjustmentRows ?? []).map(rowToPlanAdjustment);

  const config = defaultTrainingScienceConfig;
  const today = new Date().toISOString().slice(0, 10);

  // Step 1: sync planned_workouts against real activities (auto-complete or mark missed).
  // Partial-field .update() per row, not .upsert() - the Insert type requires columns
  // (user_id, workout_type, ...) that a status-only reconcile update doesn't need to touch.
  const { updatedWorkouts: reconciledUpdates } = reconcileWorkouts(workouts, activities, today);
  for (const w of reconciledUpdates) {
    const { error } = await supabase
      .from("planned_workouts")
      .update({ status: w.status, completed_activity_id: w.completedActivityId })
      .eq("id", w.id);
    if (error) throw new Error(error.message);
  }
  const reconciledById = new Map(reconciledUpdates.map((w) => [w.id, w]));
  const workoutsAfterReconcile = workouts.map((w) => reconciledById.get(w.id) ?? w);

  // Step 2: run the adaptation engine against the reconciled state.
  const weeklyVolume = computeWeeklyVolume(activities);
  const currentWeeklyVolumeKm = estimateCurrentWeeklyVolumeKm(weeklyVolume);
  const loadSeries = computeRollingLoad(activities, today, config);
  const latestLoad = loadSeries.at(-1);
  const acwr = latestLoad && latestLoad.ctl > 0 ? latestLoad.atl / latestLoad.ctl : null;

  const plan: TrainingPlan = {
    id: planRow.id,
    raceDate: planRow.race_date,
    status: planRow.status,
    generationReason: planRow.generation_reason,
    supersededByPlanId: planRow.superseded_by_plan_id,
    phases,
  };

  const result = runAdaptationEngine({
    today,
    plan,
    phases,
    weeks,
    workouts: workoutsAfterReconcile,
    existingAdjustments,
    currentWeeklyVolumeKm,
    acwr,
    config,
  });

  if (result.adjustments.length === 0 && !result.regeneratedPlan) return;

  // Step 3: persist whatever the engine decided.
  if (result.regeneratedPlan) {
    const { plan: newPlan, weeks: newWeeks, workouts: newWorkouts } = result.regeneratedPlan;

    const { error: planError } = await supabase.from("training_plans").insert(trainingPlanToInsert(newPlan, user.id));
    if (planError) throw new Error(planError.message);

    const { error: phasesError } = await supabase
      .from("plan_phases")
      .insert(newPlan.phases.map((phase) => planPhaseToInsert(phase, newPlan.id, user.id)));
    if (phasesError) throw new Error(phasesError.message);

    const { error: weeksError } = await supabase
      .from("plan_weeks")
      .insert(newWeeks.map((week) => planWeekToInsert(week, user.id)));
    if (weeksError) throw new Error(weeksError.message);

    const { error: workoutsError } = await supabase
      .from("planned_workouts")
      .insert(newWorkouts.map((workout) => plannedWorkoutToInsert(workout, user.id)));
    if (workoutsError) throw new Error(workoutsError.message);

    const { error: supersedeError } = await supabase
      .from("training_plans")
      .update({ status: "superseded", superseded_by_plan_id: newPlan.id })
      .eq("id", planRow.id);
    if (supersedeError) throw new Error(supersedeError.message);

    const { error: settingsError } = await supabase
      .from("user_settings")
      .update({ current_plan_id: newPlan.id })
      .eq("id", user.id);
    if (settingsError) throw new Error(settingsError.message);
  } else {
    if (result.updatedWeeks.length > 0) {
      const { error } = await supabase
        .from("plan_weeks")
        .upsert(result.updatedWeeks.map((w) => planWeekToInsert(w, user.id)), { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    if (result.updatedWorkouts.length > 0) {
      const { error } = await supabase
        .from("planned_workouts")
        .upsert(result.updatedWorkouts.map((w) => plannedWorkoutToInsert(w, user.id)), { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
  }

  const { error: adjustmentsError } = await supabase
    .from("plan_adjustments")
    .insert(result.adjustments.map((a) => planAdjustmentToInsert(a, user.id)));
  if (adjustmentsError) throw new Error(adjustmentsError.message);
}
