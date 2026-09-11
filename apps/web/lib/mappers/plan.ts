import type { PlanAdjustment, PlanPhase, PlannedWorkout, PlanWeek, TrainingPlan } from "@garmincoach/training-engine";
import type { Database, Json } from "@/lib/supabase/types.generated";

type TrainingPlanInsert = Database["public"]["Tables"]["training_plans"]["Insert"];
type PlanPhaseInsert = Database["public"]["Tables"]["plan_phases"]["Insert"];
type PlanPhaseRow = Database["public"]["Tables"]["plan_phases"]["Row"];
type PlanWeekInsert = Database["public"]["Tables"]["plan_weeks"]["Insert"];
type PlanWeekRow = Database["public"]["Tables"]["plan_weeks"]["Row"];
type PlannedWorkoutInsert = Database["public"]["Tables"]["planned_workouts"]["Insert"];
type PlannedWorkoutRow = Database["public"]["Tables"]["planned_workouts"]["Row"];
type PlanAdjustmentInsert = Database["public"]["Tables"]["plan_adjustments"]["Insert"];
type PlanAdjustmentRow = Database["public"]["Tables"]["plan_adjustments"]["Row"];

export function trainingPlanToInsert(plan: TrainingPlan, userId: string): TrainingPlanInsert {
  return {
    id: plan.id,
    user_id: userId,
    race_date: plan.raceDate,
    status: plan.status,
    generation_reason: plan.generationReason,
    superseded_by_plan_id: plan.supersededByPlanId,
  };
}

export function planPhaseToInsert(phase: PlanPhase, planId: string, userId: string): PlanPhaseInsert {
  return {
    id: phase.id,
    user_id: userId,
    plan_id: planId,
    phase_type: phase.phaseType,
    start_date: phase.startDate,
    end_date: phase.endDate,
    sequence_order: phase.sequenceOrder,
    target_weekly_volume_km: phase.targetWeeklyVolumeKm,
  };
}

export function planWeekToInsert(week: PlanWeek, userId: string): PlanWeekInsert {
  return {
    id: week.id,
    user_id: userId,
    phase_id: week.phaseId,
    week_start_date: week.weekStartDate,
    week_number: week.weekNumber,
    is_deload: week.isDeload,
    target_volume_km: week.targetVolumeKm,
    target_long_run_km: week.targetLongRunKm,
    status: week.status,
  };
}

export function plannedWorkoutToInsert(workout: PlannedWorkout, userId: string): PlannedWorkoutInsert {
  return {
    id: workout.id,
    user_id: userId,
    plan_week_id: workout.planWeekId,
    date: workout.date,
    sequence_in_week: workout.sequenceInWeek,
    workout_type: workout.workoutType,
    target_distance_km: workout.targetDistanceKm,
    target_duration_minutes: workout.targetDurationMinutes,
    target_pace_range: workout.targetPaceRange,
    target_hr_zone: workout.targetHrZone,
    status: workout.status,
    completed_activity_id: workout.completedActivityId,
  };
}

export function planAdjustmentToInsert(adjustment: PlanAdjustment, userId: string): PlanAdjustmentInsert {
  return {
    id: adjustment.id,
    user_id: userId,
    plan_id: adjustment.planId,
    triggered_at: adjustment.triggeredAt,
    trigger_type: adjustment.triggerType,
    trigger_context: adjustment.triggerContext as Json,
    rule_applied: adjustment.ruleApplied,
    rationale_text: adjustment.rationaleText,
    affected_week_ids: adjustment.affectedWeekIds,
  };
}

export function rowToPlanPhase(
  row: Pick<PlanPhaseRow, "id" | "phase_type" | "start_date" | "end_date" | "sequence_order" | "target_weekly_volume_km">,
): PlanPhase {
  return {
    id: row.id,
    phaseType: row.phase_type,
    startDate: row.start_date,
    endDate: row.end_date,
    sequenceOrder: row.sequence_order,
    targetWeeklyVolumeKm: row.target_weekly_volume_km,
  };
}

export function rowToPlanWeek(
  row: Pick<
    PlanWeekRow,
    "id" | "phase_id" | "week_start_date" | "week_number" | "is_deload" | "target_volume_km" | "target_long_run_km" | "status"
  >,
): PlanWeek {
  return {
    id: row.id,
    phaseId: row.phase_id,
    weekStartDate: row.week_start_date,
    weekNumber: row.week_number,
    isDeload: row.is_deload,
    targetVolumeKm: row.target_volume_km,
    targetLongRunKm: row.target_long_run_km,
    status: row.status,
  };
}

export function rowToPlannedWorkout(
  row: Pick<
    PlannedWorkoutRow,
    | "id"
    | "plan_week_id"
    | "date"
    | "sequence_in_week"
    | "workout_type"
    | "target_distance_km"
    | "target_duration_minutes"
    | "target_pace_range"
    | "target_hr_zone"
    | "status"
    | "completed_activity_id"
  >,
): PlannedWorkout {
  return {
    id: row.id,
    planWeekId: row.plan_week_id,
    date: row.date,
    sequenceInWeek: row.sequence_in_week,
    workoutType: row.workout_type,
    targetDistanceKm: row.target_distance_km,
    targetDurationMinutes: row.target_duration_minutes,
    targetPaceRange: row.target_pace_range as PlannedWorkout["targetPaceRange"],
    targetHrZone: row.target_hr_zone,
    status: row.status,
    completedActivityId: row.completed_activity_id,
  };
}

export function rowToPlanAdjustment(
  row: Pick<
    PlanAdjustmentRow,
    "id" | "plan_id" | "triggered_at" | "trigger_type" | "trigger_context" | "rule_applied" | "rationale_text" | "affected_week_ids"
  >,
): PlanAdjustment {
  return {
    id: row.id,
    planId: row.plan_id,
    triggeredAt: row.triggered_at,
    triggerType: row.trigger_type,
    triggerContext: (row.trigger_context as Record<string, unknown>) ?? {},
    ruleApplied: row.rule_applied,
    rationaleText: row.rationale_text,
    affectedWeekIds: row.affected_week_ids,
  };
}
