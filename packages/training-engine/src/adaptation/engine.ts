import type { TrainingScienceConfig } from "../config/training-science.config";
import type { PlanAdjustment, PlannedWorkout, PlanPhase, PlanWeek, TrainingPlan } from "../types";
import { detectLongBreak } from "./longBreak";
import { detectMissedWeek } from "./missedDays";
import { detectMissedSession } from "./missedSession";
import { detectOvertraining } from "./overtrainingGuard";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isNonRestMissed(w: PlannedWorkout): boolean {
  return w.workoutType !== "rest" && w.status === "missed";
}

function missedCount(weekWorkouts: PlannedWorkout[]): number {
  return weekWorkouts.filter(isNonRestMissed).length;
}

function alreadyAdjusted(
  existingAdjustments: PlanAdjustment[],
  triggerType: PlanAdjustment["triggerType"],
  key: string,
  value: string,
): boolean {
  return existingAdjustments.some((a) => a.triggerType === triggerType && a.triggerContext[key] === value);
}

export interface AdaptationEngineParams {
  today: string;
  plan: TrainingPlan;
  phases: PlanPhase[];
  /** All weeks of the active plan, any order - sorted internally by weekStartDate. */
  weeks: PlanWeek[];
  /** All workouts of the active plan, already passed through reconcileWorkouts. */
  workouts: PlannedWorkout[];
  /** Already-persisted adjustments for this plan, used for idempotency. */
  existingAdjustments: PlanAdjustment[];
  /** Recent actual weekly volume - only used if a long break triggers a plan regeneration. */
  currentWeeklyVolumeKm: number;
  /** Latest acute:chronic workload ratio, or null if there isn't enough load history yet. */
  acwr: number | null;
  config: TrainingScienceConfig;
}

export interface AdaptationEngineResult {
  adjustments: PlanAdjustment[];
  updatedWeeks: PlanWeek[];
  updatedWorkouts: PlannedWorkout[];
  regeneratedPlan?: { plan: TrainingPlan; weeks: PlanWeek[]; workouts: PlannedWorkout[] };
}

/**
 * Runs once per app open (no cron/scheduling in v1) against the active
 * plan's already-reconciled state (see reconcileWorkouts). Priority order
 * matches the approved design: a long break (phase regression) takes
 * priority over a merely-missed week, which takes priority over a single
 * missed session; the overtraining guard is a cross-cutting check that runs
 * independently of whichever of those three (if any) fired. Idempotency is
 * enforced by checking `existingAdjustments` before acting on any given
 * week/workout, so calling this repeatedly against the same state is a
 * no-op after the first call - the caller just persists whatever this
 * returns (which may be nothing).
 */
export function runAdaptationEngine(params: AdaptationEngineParams): AdaptationEngineResult {
  const { today, plan, workouts, existingAdjustments, currentWeeklyVolumeKm, acwr, config } = params;
  const weeks = [...params.weeks].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));

  const workoutsByWeekId = new Map<string, PlannedWorkout[]>();
  for (const w of workouts) {
    const list = workoutsByWeekId.get(w.planWeekId);
    if (list) list.push(w);
    else workoutsByWeekId.set(w.planWeekId, [w]);
  }
  for (const list of workoutsByWeekId.values()) list.sort((a, b) => a.sequenceInWeek - b.sequenceInWeek);

  const currentWeekIndex = weeks.findIndex((w) => w.weekStartDate <= today && today <= addDays(w.weekStartDate, 6));

  // --- 1. Long break: walk backward from the week before "current",
  // counting consecutive missed weeks. Takes priority over everything else
  // and, if triggered, replaces the whole plan - nothing else to do. ---
  if (currentWeekIndex > 0) {
    const missedWeeksDesc: PlanWeek[] = [];
    for (let i = currentWeekIndex - 1; i >= 0; i--) {
      const week = weeks[i]!;
      if (missedCount(workoutsByWeekId.get(week.id) ?? []) < config.adaptationThresholds.consecutiveMissedDaysForVolumeReduction) {
        break;
      }
      missedWeeksDesc.push(week);
    }

    const alreadyRegenerated = existingAdjustments.some(
      (a) => a.triggerType === "long_break" && a.triggerContext.oldPlanId === plan.id,
    );

    if (missedWeeksDesc.length >= config.adaptationThresholds.missedWeeksForPhaseRegression && !alreadyRegenerated) {
      const missedWeeks = missedWeeksDesc.reverse();
      const { adjustment, regeneratedPlan } = detectLongBreak({
        raceDate: plan.raceDate,
        today,
        currentWeeklyVolumeKm,
        missedWeeks,
        oldPlanId: plan.id,
        config,
      });
      return { adjustments: [adjustment], updatedWeeks: [], updatedWorkouts: [], regeneratedPlan };
    }
  }

  const adjustments: PlanAdjustment[] = [];
  const updatedWeeksById = new Map<string, PlanWeek>();
  const updatedWorkoutsById = new Map<string, PlannedWorkout>();

  // --- 2. Missed week: the week immediately before "current", if missed
  // enough and not already handled. ---
  if (currentWeekIndex > 0) {
    const missedWeek = weeks[currentWeekIndex - 1]!;
    const nextWeek = weeks[currentWeekIndex]!;
    const missedWeekWorkouts = workoutsByWeekId.get(missedWeek.id) ?? [];

    if (
      missedCount(missedWeekWorkouts) >= config.adaptationThresholds.consecutiveMissedDaysForVolumeReduction &&
      !alreadyAdjusted(existingAdjustments, "missed_consecutive_days", "missedWeekId", missedWeek.id)
    ) {
      const result = detectMissedWeek({
        planId: plan.id,
        missedWeek,
        nextWeek,
        nextWeekWorkouts: workoutsByWeekId.get(nextWeek.id) ?? [],
        config,
        today,
      });
      adjustments.push(result.adjustment);
      for (const w of result.updatedWeeks) updatedWeeksById.set(w.id, w);
      for (const w of result.updatedWorkouts) updatedWorkoutsById.set(w.id, w);
    }
  }

  // --- 3. Single missed session: exactly one missed, non-rest workout in
  // the current week. ---
  if (currentWeekIndex >= 0) {
    const currentWeek = weeks[currentWeekIndex]!;
    const currentWeekWorkouts = workoutsByWeekId.get(currentWeek.id) ?? [];
    const missed = currentWeekWorkouts.filter(isNonRestMissed);

    if (missed.length === 1 && !alreadyAdjusted(existingAdjustments, "missed_single_session", "workoutId", missed[0]!.id)) {
      const missedWorkout = missed[0]!;
      const freeRestSlot =
        currentWeekWorkouts.find((w) => w.workoutType === "rest" && w.status === "planned" && w.date > today) ??
        null;

      const result = detectMissedSession({ planId: plan.id, weekId: currentWeek.id, missedWorkout, freeRestSlot, today });
      adjustments.push(result.adjustment);
      for (const w of result.updatedWorkouts) updatedWorkoutsById.set(w.id, w);
    }
  }

  // --- 4. Overtraining guard: cross-cutting, checks the next full
  // not-yet-started week regardless of the above. ---
  if (acwr != null && currentWeekIndex >= 0 && currentWeekIndex + 1 < weeks.length) {
    const nextWeek = weeks[currentWeekIndex + 1]!;
    const result = detectOvertraining({
      planId: plan.id,
      acwr,
      nextWeek,
      nextWeekWorkouts: workoutsByWeekId.get(nextWeek.id) ?? [],
      config,
      today,
    });
    if (result) {
      adjustments.push(result.adjustment);
      for (const w of result.updatedWeeks) updatedWeeksById.set(w.id, w);
      for (const w of result.updatedWorkouts) updatedWorkoutsById.set(w.id, w);
    }
  }

  return {
    adjustments,
    updatedWeeks: [...updatedWeeksById.values()],
    updatedWorkouts: [...updatedWorkoutsById.values()],
  };
}
