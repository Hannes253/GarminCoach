import type { TrainingScienceConfig } from "../config/training-science.config";
import { generatePlan } from "../planning/periodization";
import { generateAllWorkouts } from "../planning/workoutGenerator";
import type { PlanAdjustment, PlannedWorkout, PlanWeek, TrainingPlan } from "../types";

export interface LongBreakResult {
  adjustment: PlanAdjustment;
  regeneratedPlan: {
    plan: TrainingPlan;
    weeks: PlanWeek[];
    workouts: PlannedWorkout[];
  };
}

/**
 * config.adaptationThresholds.missedWeeksForPhaseRegression or more
 * consecutive fully-missed weeks trigger a full plan regeneration from
 * today with the same race date, rather than patching volume - a training
 * gap that long makes the old plan's phase/week structure stale. Persisting
 * callers are responsible for marking the old plan "superseded" (this
 * function only returns the new one, mirroring the manual-regenerate path).
 */
export function detectLongBreak(params: {
  raceDate: string;
  today: string;
  currentWeeklyVolumeKm: number;
  /** The consecutive fully-missed weeks that triggered this, oldest first. */
  missedWeeks: PlanWeek[];
  oldPlanId: string;
  config: TrainingScienceConfig;
}): LongBreakResult {
  const { raceDate, today, currentWeeklyVolumeKm, missedWeeks, oldPlanId, config } = params;

  const { plan, weeks } = generatePlan({
    raceDate,
    today,
    currentWeeklyVolumeKm,
    config,
    generationReason: "regression_after_break",
  });
  const workouts = generateAllWorkouts(weeks, plan.phases, config);

  const adjustment: PlanAdjustment = {
    id: crypto.randomUUID(),
    planId: plan.id,
    triggeredAt: new Date(`${today}T12:00:00.000Z`).toISOString(),
    triggerType: "long_break",
    triggerContext: {
      oldPlanId,
      missedWeekIds: missedWeeks.map((w) => w.id),
      missedWeekCount: missedWeeks.length,
      currentWeeklyVolumeKm,
    },
    ruleApplied: "phase_regression_regenerate_plan",
    rationaleText:
      `${missedWeeks.length} Wochen in Folge wurden komplett verpasst (ab ${missedWeeks[0]!.weekStartDate}). ` +
      "Der Plan wurde deshalb mit dem gleichen Renndatum neu erstellt, ausgehend vom aktuellen Trainingsstand, " +
      "statt die alte Phasenstruktur fortzusetzen.",
    affectedWeekIds: missedWeeks.map((w) => w.id),
  };

  return { adjustment, regeneratedPlan: { plan, weeks, workouts } };
}
