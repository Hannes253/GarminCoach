import { describe, expect, it } from "vitest";
import type { Activity, PlannedWorkout } from "../types";
import { reconcileWorkouts } from "./reconcile";

function makeWorkout(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "w1",
    planWeekId: "week1",
    date: "2026-09-14",
    sequenceInWeek: 0,
    workoutType: "easy",
    targetDistanceKm: 8,
    targetDurationMinutes: null,
    targetPaceRange: null,
    targetHrZone: null,
    status: "planned",
    completedActivityId: null,
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    sport: "run",
    startTime: "2026-09-14T07:00:00.000Z",
    durationSeconds: 2400,
    distanceMeters: 8000,
    avgPaceSecPerKm: 300,
    avgHr: 140,
    maxHr: 160,
    hrZoneSeconds: null,
    elevationGainMeters: null,
    avgCadence: null,
    rpe: null,
    ...overrides,
  };
}

describe("reconcileWorkouts", () => {
  it("auto-completes a planned workout with a matching same-day run activity", () => {
    const workout = makeWorkout();
    const activity = makeActivity();

    const { updatedWorkouts } = reconcileWorkouts([workout], [activity], "2026-09-15");

    expect(updatedWorkouts).toHaveLength(1);
    expect(updatedWorkouts[0]!.status).toBe("completed");
    expect(updatedWorkouts[0]!.completedActivityId).toBe("a1");
  });

  it("marks a past workout with no matching activity as missed", () => {
    const workout = makeWorkout({ date: "2026-09-10" });

    const { updatedWorkouts } = reconcileWorkouts([workout], [], "2026-09-15");

    expect(updatedWorkouts).toHaveLength(1);
    expect(updatedWorkouts[0]!.status).toBe("missed");
  });

  it("leaves a future or today's workout untouched when nothing matches yet", () => {
    const future = makeWorkout({ id: "future", date: "2026-09-20" });
    const todayWorkout = makeWorkout({ id: "today", date: "2026-09-15" });

    const { updatedWorkouts } = reconcileWorkouts([future, todayWorkout], [], "2026-09-15");

    expect(updatedWorkouts).toHaveLength(0);
  });

  it("never touches rest days", () => {
    const rest = makeWorkout({ workoutType: "rest", targetDistanceKm: null, date: "2026-09-10" });

    const { updatedWorkouts } = reconcileWorkouts([rest], [], "2026-09-15");

    expect(updatedWorkouts).toHaveLength(0);
  });

  it("never touches a workout that already has a final status", () => {
    const alreadyMissed = makeWorkout({ status: "missed", date: "2026-09-10" });
    const alreadyCompleted = makeWorkout({ id: "w2", status: "completed", completedActivityId: "old-activity" });

    const { updatedWorkouts } = reconcileWorkouts(
      [alreadyMissed, alreadyCompleted],
      [makeActivity({ id: "a-new" })],
      "2026-09-15",
    );

    expect(updatedWorkouts).toHaveLength(0);
  });

  it("does not double-link an activity already linked to another workout", () => {
    const linked = makeWorkout({ id: "w1", status: "completed", completedActivityId: "a1", date: "2026-09-14" });
    const pending = makeWorkout({ id: "w2", date: "2026-09-14" });
    const activity = makeActivity({ id: "a1" });

    const { updatedWorkouts } = reconcileWorkouts([linked, pending], [activity], "2026-09-15");

    // pending has no free activity to match, and its date is in the past -> missed
    expect(updatedWorkouts).toHaveLength(1);
    expect(updatedWorkouts[0]!.id).toBe("w2");
    expect(updatedWorkouts[0]!.status).toBe("missed");
  });

  it("ignores non-run activities for matching", () => {
    const workout = makeWorkout({ date: "2026-09-10" });
    const bike = makeActivity({ sport: "bike", startTime: "2026-09-10T07:00:00.000Z" });

    const { updatedWorkouts } = reconcileWorkouts([workout], [bike], "2026-09-15");

    expect(updatedWorkouts[0]!.status).toBe("missed");
  });
});
