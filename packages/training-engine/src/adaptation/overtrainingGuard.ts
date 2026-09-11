import type { TrainingScienceConfig } from "../config/training-science.config";
import { distanceForWorkoutSlots } from "../planning/workoutGenerator";
import type { PlanAdjustment, PlannedWorkout, PlanWeek, WorkoutType } from "../types";

export interface OvertrainingResult {
  adjustment: PlanAdjustment;
  updatedWeeks: PlanWeek[];
  updatedWorkouts: PlannedWorkout[];
}

/**
 * Cross-cutting guard (runs alongside the missed-session/week/break rules,
 * not instead of them): when the acute:chronic workload ratio is over
 * config.adaptationThresholds.overreachAcwrThreshold, the next not-yet-
 * started week is converted into an inserted recovery week - volume cut by
 * recoveryWeekVolumeReductionPct and any tempo/intervals sessions downgraded
 * to easy running - rather than literally inserting an extra week into the
 * calendar, which would either push the fixed race date out or compress a
 * later week (both worse). Returns null when the guard doesn't trigger, or
 * when the candidate week is already a deload week (idempotency: a week
 * that's already reduced doesn't get reduced again on the next lazy run).
 */
export function detectOvertraining(params: {
  planId: string;
  acwr: number;
  nextWeek: PlanWeek;
  nextWeekWorkouts: PlannedWorkout[];
  config: TrainingScienceConfig;
  today: string;
}): OvertrainingResult | null {
  const { planId, acwr, nextWeek, nextWeekWorkouts, config, today } = params;

  if (acwr <= config.adaptationThresholds.overreachAcwrThreshold) return null;
  if (nextWeek.isDeload) return null;

  const newTargetVolumeKm =
    Math.round(
      nextWeek.targetVolumeKm * (1 - config.adaptationThresholds.recoveryWeekVolumeReductionPct / 100) * 10,
    ) / 10;
  const newLongRunKm = Math.min(
    config.planning.longRunMaxKm,
    Math.round(newTargetVolumeKm * config.planning.longRunPctOfWeeklyVolume * 10) / 10,
  );

  const recoveryWorkoutTypes: WorkoutType[] = nextWeekWorkouts.map((w) =>
    w.workoutType === "tempo" || w.workoutType === "intervals" ? "easy" : w.workoutType,
  );
  const distances = distanceForWorkoutSlots(recoveryWorkoutTypes, newTargetVolumeKm, newLongRunKm);

  const updatedWeeks: PlanWeek[] = [
    { ...nextWeek, isDeload: true, targetVolumeKm: newTargetVolumeKm, targetLongRunKm: newLongRunKm },
  ];
  const updatedWorkouts: PlannedWorkout[] = nextWeekWorkouts.map((w, i) => ({
    ...w,
    workoutType: recoveryWorkoutTypes[i]!,
    targetDistanceKm: distances[i]!,
  }));

  const adjustment: PlanAdjustment = {
    id: crypto.randomUUID(),
    planId,
    triggeredAt: new Date(`${today}T12:00:00.000Z`).toISOString(),
    triggerType: "overtraining_ramp",
    triggerContext: { weekId: nextWeek.id, acwr, threshold: config.adaptationThresholds.overreachAcwrThreshold },
    ruleApplied: "overtraining_guard_insert_recovery_week",
    rationaleText:
      `Das Akut-zu-chronisch-Belastungsverhältnis liegt bei ${acwr.toFixed(2)} (Schwelle ` +
      `${config.adaptationThresholds.overreachAcwrThreshold}) - erhöhtes Übertrainingsrisiko. Die Woche ab ` +
      `${nextWeek.weekStartDate} wurde deshalb zu einer Erholungswoche gemacht (Zielvolumen ${newTargetVolumeKm} km, ` +
      "Tempo-/Intervalleinheiten auf locker reduziert).",
    affectedWeekIds: [nextWeek.id],
  };

  return { adjustment, updatedWeeks, updatedWorkouts };
}
