import type { TrainingScienceConfig } from "../config/training-science.config";
import { distanceForWorkoutSlots } from "../planning/workoutGenerator";
import type { PlanAdjustment, PlannedWorkout, PlanWeek } from "../types";

export interface MissedWeekResult {
  adjustment: PlanAdjustment;
  updatedWeeks: PlanWeek[];
  updatedWorkouts: PlannedWorkout[];
}

/**
 * A fully missed week (the immediately preceding week: every non-rest
 * workout still ended up "missed", none completed) pulls the *following*
 * week's target volume down instead of letting the plan's ramp continue
 * upward from a week that didn't happen - see
 * config.adaptationThresholds.volumeReductionOnMissedWeekPct. The reduction
 * is applied off the missed week's own (already lower, pre-ramp) target,
 * not the following week's already-higher one.
 */
export function detectMissedWeek(params: {
  planId: string;
  missedWeek: PlanWeek;
  nextWeek: PlanWeek;
  nextWeekWorkouts: PlannedWorkout[];
  config: TrainingScienceConfig;
  today: string;
}): MissedWeekResult {
  const { planId, missedWeek, nextWeek, nextWeekWorkouts, config, today } = params;

  const newTargetVolumeKm =
    Math.round(missedWeek.targetVolumeKm * (1 - config.adaptationThresholds.volumeReductionOnMissedWeekPct / 100) * 10) /
    10;
  const newLongRunKm = Math.min(
    config.planning.longRunMaxKm,
    Math.round(newTargetVolumeKm * config.planning.longRunPctOfWeeklyVolume * 10) / 10,
  );

  const distances = distanceForWorkoutSlots(
    nextWeekWorkouts.map((w) => w.workoutType),
    newTargetVolumeKm,
    newLongRunKm,
  );

  const updatedWeeks: PlanWeek[] = [
    { ...nextWeek, targetVolumeKm: newTargetVolumeKm, targetLongRunKm: newLongRunKm },
  ];
  const updatedWorkouts: PlannedWorkout[] = nextWeekWorkouts.map((w, i) => ({
    ...w,
    targetDistanceKm: distances[i]!,
  }));

  const adjustment: PlanAdjustment = {
    id: crypto.randomUUID(),
    planId,
    triggeredAt: new Date(`${today}T12:00:00.000Z`).toISOString(),
    triggerType: "missed_consecutive_days",
    triggerContext: {
      missedWeekId: missedWeek.id,
      missedWeekStart: missedWeek.weekStartDate,
      nextWeekId: nextWeek.id,
      previousTargetVolumeKm: nextWeek.targetVolumeKm,
      newTargetVolumeKm,
    },
    ruleApplied: "missed_week_reduce_next_week_volume",
    rationaleText:
      `Die Woche ab ${missedWeek.weekStartDate} wurde komplett verpasst. Das Zielvolumen der Folgewoche ` +
      `(ab ${nextWeek.weekStartDate}) wurde deshalb von ${nextWeek.targetVolumeKm} km auf ${newTargetVolumeKm} km ` +
      "reduziert, statt den Aufbau einfach fortzusetzen.",
    affectedWeekIds: [missedWeek.id, nextWeek.id],
  };

  return { adjustment, updatedWeeks, updatedWorkouts };
}
