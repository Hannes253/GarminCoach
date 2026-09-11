import type { PlanAdjustment, PlannedWorkout, WorkoutType } from "../types";

export interface MissedSessionResult {
  adjustment: PlanAdjustment;
  updatedWorkouts: PlannedWorkout[];
}

const KEY_WORKOUT_TYPES = new Set<WorkoutType>(["tempo", "intervals", "long_run"]);

/**
 * Handles exactly one missed session in the current week. Per the app's
 * core design decision, a missed session is never "made up" by adding
 * extra volume: a missed *key* (quality) session is at most moved onto an
 * already-scheduled rest day later in the same week (reordering, not
 * addition - the week's total planned load doesn't grow); a missed easy/
 * recovery session is simply not made up at all.
 *
 * Callers (the adaptation engine) are responsible for only invoking this
 * once per missed workout - see the `status` transition to
 * "skipped_replanned" (reordered) which naturally makes a workout ineligible
 * next time, and for workouts left as "missed" (no makeup), for checking
 * plan_adjustments for an existing record before calling again.
 */
export function detectMissedSession(params: {
  planId: string;
  weekId: string;
  missedWorkout: PlannedWorkout;
  /** Candidate to reorder the missed key session into - a still-"planned" rest day later in the same week. */
  freeRestSlot: PlannedWorkout | null;
  today: string;
}): MissedSessionResult {
  const { planId, weekId, missedWorkout, freeRestSlot, today } = params;
  const updatedWorkouts: PlannedWorkout[] = [];

  const canReorder = KEY_WORKOUT_TYPES.has(missedWorkout.workoutType) && freeRestSlot != null;

  let ruleApplied: string;
  let rationaleText: string;

  if (canReorder && freeRestSlot) {
    updatedWorkouts.push({ ...missedWorkout, status: "skipped_replanned" });
    updatedWorkouts.push({
      ...freeRestSlot,
      workoutType: missedWorkout.workoutType,
      targetDistanceKm: missedWorkout.targetDistanceKm,
    });
    ruleApplied = "missed_session_reorder_into_rest_day";
    rationaleText =
      `Die Einheit am ${missedWorkout.date} (${missedWorkout.workoutType}) wurde verpasst. Da es eine ` +
      `Schlüsseleinheit war, wurde sie auf den Ruhetag am ${freeRestSlot.date} verschoben, statt sie ` +
      "zusätzlich nachzuholen - das geplante Wochenvolumen bleibt dadurch unverändert.";
  } else {
    ruleApplied = "missed_session_no_makeup";
    rationaleText =
      `Die Einheit am ${missedWorkout.date} (${missedWorkout.workoutType}) wurde verpasst und wird nicht ` +
      "nachgeholt - verpasste Einheiten werden bewusst nicht durch zusätzliches Volumen kompensiert.";
  }

  const adjustment: PlanAdjustment = {
    id: crypto.randomUUID(),
    planId,
    triggeredAt: new Date(`${today}T12:00:00.000Z`).toISOString(),
    triggerType: "missed_single_session",
    triggerContext: { workoutId: missedWorkout.id, workoutDate: missedWorkout.date, weekId },
    ruleApplied,
    rationaleText,
    affectedWeekIds: [weekId],
  };

  return { adjustment, updatedWorkouts };
}
