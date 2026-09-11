import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { PlanPhase, PlanWeek } from "../types";
import { generateAllWorkouts, generateWeekWorkouts } from "./workoutGenerator";
import { generatePlan } from "./periodization";

const config = defaultTrainingScienceConfig;

function makePhase(overrides: Partial<PlanPhase> = {}): PlanPhase {
  return {
    id: "phase-1",
    phaseType: "base",
    startDate: "2026-09-14",
    endDate: "2026-09-20",
    sequenceOrder: 0,
    targetWeeklyVolumeKm: 20,
    ...overrides,
  };
}

function makeWeek(overrides: Partial<PlanWeek> = {}): PlanWeek {
  return {
    id: "week-1",
    phaseId: "phase-1",
    weekStartDate: "2026-09-14", // a Monday
    weekNumber: 1,
    isDeload: false,
    targetVolumeKm: 20,
    targetLongRunKm: 6.4,
    status: "planned",
    ...overrides,
  };
}

describe("generateWeekWorkouts", () => {
  it("produces exactly 7 workouts, one per day of the week, in order Mon-Sun", () => {
    const phase = makePhase();
    const week = makeWeek();
    const workouts = generateWeekWorkouts(week, phase, config);

    expect(workouts).toHaveLength(7);
    expect(workouts.map((w) => w.date)).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect(workouts.map((w) => w.sequenceInWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("matches the phase's weeklyTemplate workout types exactly", () => {
    const phase = makePhase({ phaseType: "build" });
    const week = makeWeek();
    const workouts = generateWeekWorkouts(week, phase, config);

    expect(workouts.map((w) => w.workoutType)).toEqual(config.planning.weeklyTemplates.build);
  });

  it("rest days carry no target distance", () => {
    const phase = makePhase();
    const week = makeWeek();
    const workouts = generateWeekWorkouts(week, phase, config);

    for (const w of workouts) {
      if (w.workoutType === "rest") {
        expect(w.targetDistanceKm).toBeNull();
      } else {
        expect(w.targetDistanceKm).not.toBeNull();
        expect(w.targetDistanceKm!).toBeGreaterThan(0);
      }
    }
  });

  it("the long_run slot gets exactly targetLongRunKm", () => {
    const phase = makePhase();
    const week = makeWeek({ targetLongRunKm: 8 });
    const workouts = generateWeekWorkouts(week, phase, config);

    const longRun = workouts.find((w) => w.workoutType === "long_run")!;
    expect(longRun.targetDistanceKm).toBe(8);
  });

  it("non-long, non-rest slots evenly split the remaining volume", () => {
    const phase = makePhase();
    const week = makeWeek({ targetVolumeKm: 20, targetLongRunKm: 6 });
    const workouts = generateWeekWorkouts(week, phase, config);

    const others = workouts.filter((w) => w.workoutType !== "rest" && w.workoutType !== "long_run");
    const distances = others.map((w) => w.targetDistanceKm!);
    // All equal (evenly split).
    for (const d of distances) {
      expect(d).toBeCloseTo(distances[0]!, 5);
    }
    // Sums to the remaining volume (20 - 6 = 14).
    const total = distances.reduce((a, b) => a + b, 0) + 6;
    expect(total).toBeCloseTo(20, 0);
  });

  it("falls back to the templated long-run share when targetLongRunKm is null", () => {
    const phase = makePhase();
    const week = makeWeek({ targetVolumeKm: 20, targetLongRunKm: null });
    const workouts = generateWeekWorkouts(week, phase, config);

    const longRun = workouts.find((w) => w.workoutType === "long_run")!;
    expect(longRun.targetDistanceKm).toBeCloseTo(20 * config.planning.longRunPctOfWeeklyVolume, 5);
  });

  it("every workout references the correct planWeekId and has a planned status", () => {
    const phase = makePhase();
    const week = makeWeek({ id: "week-abc" });
    const workouts = generateWeekWorkouts(week, phase, config);

    for (const w of workouts) {
      expect(w.planWeekId).toBe("week-abc");
      expect(w.status).toBe("planned");
      expect(w.completedActivityId).toBeNull();
    }
  });

  it("uses each phase's own template (taper differs from base)", () => {
    const week = makeWeek();
    const baseWorkouts = generateWeekWorkouts(week, makePhase({ phaseType: "base" }), config);
    const taperWorkouts = generateWeekWorkouts(week, makePhase({ phaseType: "taper" }), config);

    expect(baseWorkouts.map((w) => w.workoutType)).not.toEqual(taperWorkouts.map((w) => w.workoutType));
  });
});

describe("generateAllWorkouts", () => {
  it("generates 7 workouts per week for a full generated plan, with all long_run distances within the configured cap", () => {
    const { plan, weeks } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    const workouts = generateAllWorkouts(weeks, plan.phases, config);

    expect(workouts).toHaveLength(weeks.length * 7);

    const longRuns = workouts.filter((w) => w.workoutType === "long_run");
    expect(longRuns).toHaveLength(weeks.length);
    for (const lr of longRuns) {
      expect(lr.targetDistanceKm!).toBeLessThanOrEqual(config.planning.longRunMaxKm + 0.1);
    }
  });

  it("throws if a week references a phaseId not present in phases", () => {
    const orphanWeek = makeWeek({ phaseId: "does-not-exist" });
    expect(() => generateAllWorkouts([orphanWeek], [makePhase()], config)).toThrow();
  });
});
