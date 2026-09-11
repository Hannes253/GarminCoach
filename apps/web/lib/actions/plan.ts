"use server";

import { revalidatePath } from "next/cache";
import {
  computeWeeklyVolume,
  defaultTrainingScienceConfig,
  generateAllWorkouts,
  generatePlan,
  type TrainingPlan,
} from "@garmincoach/training-engine";
import { loadEngineActivities } from "@/lib/data/activities";
import { planPhaseToInsert, plannedWorkoutToInsert, planWeekToInsert, trainingPlanToInsert } from "@/lib/mappers/plan";
import { createClient } from "@/lib/supabase/server";

/**
 * Average weekly running volume over the last few weeks that actually have
 * runs, as the ramp's starting point - matches the "average of the last 2-3
 * weeks" assumption documented on generatePlan's currentWeeklyVolumeKm param.
 * Recent-but-incomplete current week is included; generatePlan treats <=0 as
 * "no data" and falls back to a conservative default on its own.
 */
function estimateCurrentWeeklyVolumeKm(weeklyVolume: ReturnType<typeof computeWeeklyVolume>): number {
  const recentWeeks = weeklyVolume.slice(-3);
  if (recentWeeks.length === 0) return 0;
  return recentWeeks.reduce((sum, w) => sum + w.distanceKm, 0) / recentWeeks.length;
}

export async function generateAndSaveTrainingPlan(): Promise<{ planId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("race_date")
    .eq("id", user.id)
    .maybeSingle();
  if (!settings?.race_date) {
    throw new Error("Kein Renndatum gesetzt. Bitte zuerst in den Einstellungen ein Renndatum eintragen.");
  }

  const { data: existingActivePlan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const activities = await loadEngineActivities();
  const weeklyVolume = computeWeeklyVolume(activities);
  const currentWeeklyVolumeKm = estimateCurrentWeeklyVolumeKm(weeklyVolume);
  const today = new Date().toISOString().slice(0, 10);
  const config = defaultTrainingScienceConfig;

  const generationReason: TrainingPlan["generationReason"] = existingActivePlan ? "manual_regenerate" : "initial";

  const { plan, weeks } = generatePlan({
    raceDate: settings.race_date,
    today,
    currentWeeklyVolumeKm,
    config,
    generationReason,
  });
  const workouts = generateAllWorkouts(weeks, plan.phases, config);

  const { error: planError } = await supabase.from("training_plans").insert(trainingPlanToInsert(plan, user.id));
  if (planError) throw new Error(planError.message);

  const { error: phasesError } = await supabase
    .from("plan_phases")
    .insert(plan.phases.map((phase) => planPhaseToInsert(phase, plan.id, user.id)));
  if (phasesError) throw new Error(phasesError.message);

  const { error: weeksError } = await supabase
    .from("plan_weeks")
    .insert(weeks.map((week) => planWeekToInsert(week, user.id)));
  if (weeksError) throw new Error(weeksError.message);

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workouts.map((workout) => plannedWorkoutToInsert(workout, user.id)));
  if (workoutsError) throw new Error(workoutsError.message);

  if (existingActivePlan) {
    const { error: supersedeError } = await supabase
      .from("training_plans")
      .update({ status: "superseded", superseded_by_plan_id: plan.id })
      .eq("id", existingActivePlan.id);
    if (supersedeError) throw new Error(supersedeError.message);
  }

  const { error: settingsError } = await supabase
    .from("user_settings")
    .update({ current_plan_id: plan.id })
    .eq("id", user.id);
  if (settingsError) throw new Error(settingsError.message);

  revalidatePath("/plan");
  revalidatePath("/");

  return { planId: plan.id };
}
