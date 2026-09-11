import type { TrainingScienceConfig } from "../config/training-science.config";
import type { PlanPhase, PlannedWorkout, PlanWeek, WorkoutType } from "../types";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Splits a week's targetVolumeKm across its non-rest slots using the phase's
 * fixed weeklyTemplate: the long_run slot gets targetLongRunKm (falling back
 * to its templated share of volume if the week carries no long-run target),
 * and everything else that's left is split evenly across the remaining
 * non-rest slots. Quality sessions (tempo/intervals) are not weighted
 * differently by distance in v1 - only by workoutType, which apps/web later
 * turns into pace/effort guidance.
 */
export function generateWeekWorkouts(
  week: PlanWeek,
  phase: PlanPhase,
  config: TrainingScienceConfig,
): PlannedWorkout[] {
  const template = config.planning.weeklyTemplates[phase.phaseType];

  const longRunKm =
    week.targetLongRunKm ?? week.targetVolumeKm * config.planning.longRunPctOfWeeklyVolume;
  const nonRestNonLongCount = template.filter((t) => t !== "rest" && t !== "long_run").length;
  const remainingVolumeKm = Math.max(0, week.targetVolumeKm - longRunKm);
  const perSlotKm = nonRestNonLongCount > 0 ? remainingVolumeKm / nonRestNonLongCount : 0;

  return template.map((workoutType, dayIndex) => {
    const date = addDays(week.weekStartDate, dayIndex);
    const targetDistanceKm = distanceForSlot(workoutType, longRunKm, perSlotKm);

    return {
      id: crypto.randomUUID(),
      planWeekId: week.id,
      date,
      sequenceInWeek: dayIndex,
      workoutType,
      targetDistanceKm: targetDistanceKm === null ? null : Math.round(targetDistanceKm * 10) / 10,
      targetDurationMinutes: null,
      targetPaceRange: null,
      targetHrZone: null,
      status: "planned",
      completedActivityId: null,
    };
  });
}

function distanceForSlot(workoutType: WorkoutType, longRunKm: number, perSlotKm: number): number | null {
  if (workoutType === "rest") return null;
  if (workoutType === "long_run") return longRunKm;
  return perSlotKm;
}

/** Convenience wrapper: generates workouts for every week, keyed by phase. */
export function generateAllWorkouts(
  weeks: PlanWeek[],
  phases: PlanPhase[],
  config: TrainingScienceConfig,
): PlannedWorkout[] {
  const phasesById = new Map(phases.map((p) => [p.id, p]));
  return weeks.flatMap((week) => {
    const phase = phasesById.get(week.phaseId);
    if (!phase) {
      throw new Error(`generateAllWorkouts: no phase found for week ${week.id} (phaseId=${week.phaseId})`);
    }
    return generateWeekWorkouts(week, phase, config);
  });
}
