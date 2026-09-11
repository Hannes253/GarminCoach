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
  const distances = distanceForWorkoutSlots(template, week.targetVolumeKm, longRunKm);

  return template.map((workoutType, dayIndex) => ({
    id: crypto.randomUUID(),
    planWeekId: week.id,
    date: addDays(week.weekStartDate, dayIndex),
    sequenceInWeek: dayIndex,
    workoutType,
    targetDistanceKm: distances[dayIndex]!,
    targetDurationMinutes: null,
    targetPaceRange: null,
    targetHrZone: null,
    status: "planned",
    completedActivityId: null,
  }));
}

/**
 * Splits targetVolumeKm across a fixed sequence of workout-type slots: the
 * long_run slot gets longRunKm, everything else that's left is split evenly
 * across the remaining non-rest slots, rest slots get null. Shared between
 * generateWeekWorkouts (a brand-new week) and the adaptation engine
 * (redistributing volume across an existing week's unchanged slot sequence,
 * e.g. after a missed-week volume reduction).
 */
export function distanceForWorkoutSlots(
  workoutTypes: WorkoutType[],
  targetVolumeKm: number,
  longRunKm: number,
): Array<number | null> {
  const nonRestNonLongCount = workoutTypes.filter((t) => t !== "rest" && t !== "long_run").length;
  const remainingVolumeKm = Math.max(0, targetVolumeKm - longRunKm);
  const perSlotKm = nonRestNonLongCount > 0 ? remainingVolumeKm / nonRestNonLongCount : 0;

  return workoutTypes.map((workoutType) => {
    const distance = distanceForSlot(workoutType, longRunKm, perSlotKm);
    return distance === null ? null : Math.round(distance * 10) / 10;
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
