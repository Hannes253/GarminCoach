import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { PlannedWorkout, PlanPhase, PlanWeek, TrainingPlan, WorkoutType } from "../types";
import { runAdaptationEngine } from "./engine";

const config = defaultTrainingScienceConfig;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function makePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: "plan-1",
    raceDate: "2027-09-26",
    status: "active",
    generationReason: "initial",
    supersededByPlanId: null,
    phases: [],
    ...overrides,
  };
}

function makePhase(overrides: Partial<PlanPhase> = {}): PlanPhase {
  return {
    id: "phase-1",
    phaseType: "base",
    startDate: "2026-01-05",
    endDate: "2026-03-01",
    sequenceOrder: 0,
    targetWeeklyVolumeKm: 20,
    ...overrides,
  };
}

function makeWeek(overrides: Partial<PlanWeek> = {}): PlanWeek {
  return {
    id: "week-1",
    phaseId: "phase-1",
    weekStartDate: "2026-01-05",
    weekNumber: 1,
    isDeload: false,
    targetVolumeKm: 20,
    targetLongRunKm: 6,
    status: "planned",
    ...overrides,
  };
}

/** Builds a full base-template week's 7 workouts (Mon rest .. Sun long_run) with the given per-day statuses. */
function makeWeekWorkouts(
  week: PlanWeek,
  statuses: Array<PlannedWorkout["status"]>,
  completedActivityIds: Array<string | null> = [],
): PlannedWorkout[] {
  const template: WorkoutType[] = ["rest", "easy", "easy", "rest", "easy", "rest", "long_run"];
  return template.map((workoutType, i) => ({
    id: `${week.id}-w${i}`,
    planWeekId: week.id,
    date: addDays(week.weekStartDate, i),
    sequenceInWeek: i,
    workoutType,
    targetDistanceKm: workoutType === "rest" ? null : workoutType === "long_run" ? week.targetLongRunKm : 5,
    targetDurationMinutes: null,
    targetPaceRange: null,
    targetHrZone: null,
    status: statuses[i] ?? "planned",
    completedActivityId: completedActivityIds[i] ?? null,
  }));
}

describe("runAdaptationEngine", () => {
  it("scenario 1: a single missed key session is reordered onto an already-scheduled rest day, not made up", () => {
    const phase = makePhase();
    const week = makeWeek();
    const workouts = makeWeekWorkouts(week, ["planned", "completed", "completed", "planned", "planned", "planned", "planned"]);
    // Override Tuesday (index 1) to a missed key session instead of the base template's "easy".
    workouts[1] = { ...workouts[1]!, workoutType: "tempo", targetDistanceKm: 8, status: "missed" };

    const wednesday = addDays(week.weekStartDate, 2);

    const result = runAdaptationEngine({
      today: wednesday,
      plan: makePlan({ phases: [phase] }),
      phases: [phase],
      weeks: [week],
      workouts,
      existingAdjustments: [],
      currentWeeklyVolumeKm: 20,
      acwr: null,
      config,
    });

    expect(result.regeneratedPlan).toBeUndefined();
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0]!.triggerType).toBe("missed_single_session");
    expect(result.adjustments[0]!.ruleApplied).toBe("missed_session_reorder_into_rest_day");

    const originalMissed = result.updatedWorkouts.find((w) => w.id === workouts[1]!.id)!;
    expect(originalMissed.status).toBe("skipped_replanned");

    // Thursday (index 3) was the next still-planned rest day - it should now carry the tempo session.
    const reorderedInto = result.updatedWorkouts.find((w) => w.id === workouts[3]!.id)!;
    expect(reorderedInto.workoutType).toBe("tempo");
    expect(reorderedInto.targetDistanceKm).toBe(8);
  });

  it("scenario 1b: a single missed easy session is simply not made up (no reorder)", () => {
    const phase = makePhase();
    const week = makeWeek();
    const workouts = makeWeekWorkouts(week, ["planned", "missed", "completed", "planned", "planned", "planned", "planned"]);
    const wednesday = addDays(week.weekStartDate, 2);

    const result = runAdaptationEngine({
      today: wednesday,
      plan: makePlan({ phases: [phase] }),
      phases: [phase],
      weeks: [week],
      workouts,
      existingAdjustments: [],
      currentWeeklyVolumeKm: 20,
      acwr: null,
      config,
    });

    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0]!.ruleApplied).toBe("missed_session_no_makeup");
    expect(result.updatedWorkouts).toHaveLength(0);
  });

  it("scenario 2: a fully missed week reduces the following week's target volume instead of continuing the ramp", () => {
    const phase = makePhase();
    const missedWeek = makeWeek({ id: "week-1", weekNumber: 1, weekStartDate: "2026-01-05", targetVolumeKm: 20 });
    const nextWeek = makeWeek({
      id: "week-2",
      weekNumber: 2,
      weekStartDate: addDays(missedWeek.weekStartDate, 7),
      targetVolumeKm: 22, // the ramped-up target the missed week's failure shouldn't be allowed to continue into
      targetLongRunKm: 7,
    });

    const missedWeekWorkouts = makeWeekWorkouts(missedWeek, [
      "planned",
      "missed",
      "missed",
      "planned",
      "missed",
      "planned",
      "missed",
    ]);
    const nextWeekWorkouts = makeWeekWorkouts(nextWeek, [
      "planned",
      "planned",
      "planned",
      "planned",
      "planned",
      "planned",
      "planned",
    ]);

    const today = nextWeek.weekStartDate; // the following Monday - next week has just started, untouched so far

    const result = runAdaptationEngine({
      today,
      plan: makePlan({ phases: [phase] }),
      phases: [phase],
      weeks: [missedWeek, nextWeek],
      workouts: [...missedWeekWorkouts, ...nextWeekWorkouts],
      existingAdjustments: [],
      currentWeeklyVolumeKm: 20,
      acwr: null,
      config,
    });

    expect(result.regeneratedPlan).toBeUndefined();
    const missedWeekAdjustment = result.adjustments.find((a) => a.triggerType === "missed_consecutive_days");
    expect(missedWeekAdjustment).toBeDefined();

    const updatedNextWeek = result.updatedWeeks.find((w) => w.id === nextWeek.id)!;
    const expectedVolume = Math.round(missedWeek.targetVolumeKm * (1 - config.adaptationThresholds.volumeReductionOnMissedWeekPct / 100) * 10) / 10;
    expect(updatedNextWeek.targetVolumeKm).toBe(expectedVolume);
    expect(updatedNextWeek.targetVolumeKm).toBeLessThan(nextWeek.targetVolumeKm);

    const updatedWorkoutsForNextWeek = result.updatedWorkouts.filter((w) => w.planWeekId === nextWeek.id);
    expect(updatedWorkoutsForNextWeek.length).toBeGreaterThan(0);

    // Idempotency: running again with this adjustment already recorded does nothing more.
    const secondRun = runAdaptationEngine({
      today,
      plan: makePlan({ phases: [phase] }),
      phases: [phase],
      weeks: [missedWeek, nextWeek],
      workouts: [...missedWeekWorkouts, ...nextWeekWorkouts],
      existingAdjustments: result.adjustments,
      currentWeeklyVolumeKm: 20,
      acwr: null,
      config,
    });
    expect(secondRun.adjustments.find((a) => a.triggerType === "missed_consecutive_days")).toBeUndefined();
  });

  it("scenario 3: three consecutive missed weeks trigger a full phase regression with the same race date", () => {
    const phase = makePhase();
    const raceDate = "2027-09-26";
    const weeks: PlanWeek[] = [];
    const workouts: PlannedWorkout[] = [];

    for (let i = 0; i < 3; i++) {
      const week = makeWeek({
        id: `week-${i + 1}`,
        weekNumber: i + 1,
        weekStartDate: addDays("2026-01-05", i * 7),
        targetVolumeKm: 20 + i,
      });
      weeks.push(week);
      workouts.push(
        ...makeWeekWorkouts(week, ["planned", "missed", "missed", "planned", "missed", "planned", "missed"]),
      );
    }

    const currentWeek = makeWeek({
      id: "week-4",
      weekNumber: 4,
      weekStartDate: addDays("2026-01-05", 21),
      targetVolumeKm: 23,
    });
    weeks.push(currentWeek);
    workouts.push(
      ...makeWeekWorkouts(currentWeek, ["planned", "planned", "planned", "planned", "planned", "planned", "planned"]),
    );

    const result = runAdaptationEngine({
      today: currentWeek.weekStartDate,
      plan: makePlan({ id: "old-plan", raceDate, phases: [phase] }),
      phases: [phase],
      weeks,
      workouts,
      existingAdjustments: [],
      currentWeeklyVolumeKm: 0,
      acwr: null,
      config,
    });

    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0]!.triggerType).toBe("long_break");
    expect(result.adjustments[0]!.triggerContext.missedWeekCount).toBe(3);

    expect(result.regeneratedPlan).toBeDefined();
    expect(result.regeneratedPlan!.plan.raceDate).toBe(raceDate);
    expect(result.regeneratedPlan!.plan.generationReason).toBe("regression_after_break");
    expect(result.regeneratedPlan!.plan.id).not.toBe("old-plan");
    expect(result.regeneratedPlan!.weeks.length).toBeGreaterThan(0);
    expect(result.regeneratedPlan!.workouts.length).toBeGreaterThan(0);

    // Idempotency: a second run against the *old* plan with this adjustment recorded doesn't regenerate again.
    const secondRun = runAdaptationEngine({
      today: currentWeek.weekStartDate,
      plan: makePlan({ id: "old-plan", raceDate, phases: [phase] }),
      phases: [phase],
      weeks,
      workouts,
      existingAdjustments: result.adjustments,
      currentWeeklyVolumeKm: 0,
      acwr: null,
      config,
    });
    expect(secondRun.regeneratedPlan).toBeUndefined();
  });

  it("overtraining guard: a high acute:chronic workload ratio converts the next week into a recovery week", () => {
    const phase = makePhase({ phaseType: "build" });
    const currentWeek = makeWeek({ id: "week-1", weekNumber: 1, weekStartDate: "2026-01-05" });
    const nextWeek = makeWeek({
      id: "week-2",
      weekNumber: 2,
      weekStartDate: addDays(currentWeek.weekStartDate, 7),
      targetVolumeKm: 30,
      targetLongRunKm: 10,
    });

    const currentWeekWorkouts = makeWeekWorkouts(currentWeek, [
      "planned",
      "completed",
      "completed",
      "planned",
      "completed",
      "planned",
      "completed",
    ]);
    const nextWeekWorkouts = makeWeekWorkouts(nextWeek, [
      "planned",
      "planned",
      "planned",
      "planned",
      "planned",
      "planned",
      "planned",
    ]);
    // Give next week a tempo session to verify it gets downgraded to easy.
    nextWeekWorkouts[1] = { ...nextWeekWorkouts[1]!, workoutType: "tempo", targetDistanceKm: 10 };

    const result = runAdaptationEngine({
      today: currentWeek.weekStartDate,
      plan: makePlan({ phases: [phase] }),
      phases: [phase],
      weeks: [currentWeek, nextWeek],
      workouts: [...currentWeekWorkouts, ...nextWeekWorkouts],
      existingAdjustments: [],
      currentWeeklyVolumeKm: 25,
      acwr: 1.8,
      config,
    });

    const guardAdjustment = result.adjustments.find((a) => a.triggerType === "overtraining_ramp");
    expect(guardAdjustment).toBeDefined();

    const updatedNextWeek = result.updatedWeeks.find((w) => w.id === nextWeek.id)!;
    expect(updatedNextWeek.isDeload).toBe(true);
    expect(updatedNextWeek.targetVolumeKm).toBeLessThan(nextWeek.targetVolumeKm);

    const downgradedTempo = result.updatedWorkouts.find((w) => w.id === nextWeekWorkouts[1]!.id)!;
    expect(downgradedTempo.workoutType).toBe("easy");
  });

  it("overtraining guard does not fire again once the candidate week is already a deload week", () => {
    const phase = makePhase({ phaseType: "build" });
    const currentWeek = makeWeek({ id: "week-1", weekNumber: 1, weekStartDate: "2026-01-05" });
    const nextWeek = makeWeek({
      id: "week-2",
      weekNumber: 2,
      weekStartDate: addDays(currentWeek.weekStartDate, 7),
      isDeload: true,
      targetVolumeKm: 15,
    });

    const result = runAdaptationEngine({
      today: currentWeek.weekStartDate,
      plan: makePlan({ phases: [phase] }),
      phases: [phase],
      weeks: [currentWeek, nextWeek],
      workouts: [
        ...makeWeekWorkouts(currentWeek, Array(7).fill("planned")),
        ...makeWeekWorkouts(nextWeek, Array(7).fill("planned")),
      ],
      existingAdjustments: [],
      currentWeeklyVolumeKm: 25,
      acwr: 2.0,
      config,
    });

    expect(result.adjustments.find((a) => a.triggerType === "overtraining_ramp")).toBeUndefined();
  });

  it("does nothing when nothing is missed and the load isn't overreaching", () => {
    const phase = makePhase();
    const week = makeWeek();
    const workouts = makeWeekWorkouts(week, Array(7).fill("planned") as PlannedWorkout["status"][]);

    const result = runAdaptationEngine({
      today: week.weekStartDate,
      plan: makePlan({ phases: [phase] }),
      phases: [phase],
      weeks: [week],
      workouts,
      existingAdjustments: [],
      currentWeeklyVolumeKm: 20,
      acwr: 1.0,
      config,
    });

    expect(result.adjustments).toHaveLength(0);
    expect(result.updatedWeeks).toHaveLength(0);
    expect(result.updatedWorkouts).toHaveLength(0);
    expect(result.regeneratedPlan).toBeUndefined();
  });
});
