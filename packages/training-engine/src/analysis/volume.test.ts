import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { Activity } from "../types";
import { computeWeeklyVolume, detectRampRateWarnings } from "./volume";

function run(startTime: string, km: number, overrides: Partial<Activity> = {}): Activity {
  return {
    id: `run-${startTime}`,
    sport: "run",
    startTime,
    durationSeconds: km * 360,
    distanceMeters: km * 1000,
    avgPaceSecPerKm: 360,
    avgHr: 150,
    maxHr: 170,
    hrZoneSeconds: null,
    elevationGainMeters: null,
    avgCadence: null,
    rpe: null,
    ...overrides,
  };
}

describe("computeWeeklyVolume", () => {
  it("sums running distance per Monday-starting week", () => {
    const points = computeWeeklyVolume([
      run("2026-03-02T07:00:00Z", 10), // Monday
      run("2026-03-04T07:00:00Z", 8), // Wednesday, same week
      run("2026-03-09T07:00:00Z", 12), // next Monday
    ]);

    expect(points).toEqual([
      { weekStart: "2026-03-02", distanceKm: 18, longRunKm: 10, sessionCount: 2 },
      { weekStart: "2026-03-09", distanceKm: 12, longRunKm: 12, sessionCount: 1 },
    ]);
  });

  it("ignores non-run activities", () => {
    const points = computeWeeklyVolume([
      run("2026-03-02T07:00:00Z", 10),
      { ...run("2026-03-02T09:00:00Z", 0), sport: "bike", distanceMeters: 30000 },
      { ...run("2026-03-02T18:00:00Z", 0), sport: "strength", distanceMeters: null },
    ]);
    expect(points).toEqual([{ weekStart: "2026-03-02", distanceKm: 10, longRunKm: 10, sessionCount: 1 }]);
  });

  it("assigns a Sunday activity to the week that started the preceding Monday", () => {
    const points = computeWeeklyVolume([run("2026-03-08T07:00:00Z", 5)]); // Sunday
    expect(points).toEqual([{ weekStart: "2026-03-02", distanceKm: 5, longRunKm: 5, sessionCount: 1 }]);
  });
});

describe("detectRampRateWarnings", () => {
  it("flags a week-over-week increase beyond the configured ramp rate", () => {
    const weeks = [
      { weekStart: "2026-03-02", distanceKm: 20, longRunKm: 10, sessionCount: 3 },
      { weekStart: "2026-03-09", distanceKm: 25, longRunKm: 12, sessionCount: 3 }, // +25%
    ];
    const warnings = detectRampRateWarnings(weeks, defaultTrainingScienceConfig);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe("ramp_rate_exceeded");
    expect(warnings[0]?.context.weekStart).toBe("2026-03-09");
  });

  it("does not flag an increase within the configured ramp rate", () => {
    const weeks = [
      { weekStart: "2026-03-02", distanceKm: 20, longRunKm: 10, sessionCount: 3 },
      { weekStart: "2026-03-09", distanceKm: 21.5, longRunKm: 11, sessionCount: 3 }, // +7.5%
    ];
    expect(detectRampRateWarnings(weeks, defaultTrainingScienceConfig)).toHaveLength(0);
  });

  it("does not flag a decrease (deload/taper weeks)", () => {
    const weeks = [
      { weekStart: "2026-03-02", distanceKm: 40, longRunKm: 20, sessionCount: 4 },
      { weekStart: "2026-03-09", distanceKm: 25, longRunKm: 12, sessionCount: 3 },
    ];
    expect(detectRampRateWarnings(weeks, defaultTrainingScienceConfig)).toHaveLength(0);
  });

  it("skips a comparison out of a zero-volume week rather than dividing by zero", () => {
    const weeks = [
      { weekStart: "2026-03-02", distanceKm: 0, longRunKm: 0, sessionCount: 0 },
      { weekStart: "2026-03-09", distanceKm: 20, longRunKm: 10, sessionCount: 3 },
    ];
    expect(() => detectRampRateWarnings(weeks, defaultTrainingScienceConfig)).not.toThrow();
    expect(detectRampRateWarnings(weeks, defaultTrainingScienceConfig)).toHaveLength(0);
  });
});
