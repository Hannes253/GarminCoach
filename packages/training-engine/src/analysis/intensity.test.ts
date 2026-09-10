import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { Activity } from "../types";
import { computeIntensityDistribution } from "./intensity";

function run(hrZoneSeconds: Activity["hrZoneSeconds"]): Activity {
  return {
    id: "r1",
    sport: "run",
    startTime: "2026-03-01T07:00:00.000Z",
    durationSeconds: 3600,
    distanceMeters: 10000,
    avgPaceSecPerKm: 360,
    avgHr: 150,
    maxHr: 170,
    hrZoneSeconds,
    elevationGainMeters: null,
    avgCadence: null,
    rpe: null,
  };
}

describe("computeIntensityDistribution", () => {
  it("classifies z1/z2 as easy, z3 as moderate, z4/z5 as hard", () => {
    const dist = computeIntensityDistribution(
      [run({ z1: 2400, z2: 2400, z3: 1200, z4: 600, z5: 600 })], // 4800 easy, 1200 moderate, 1200 hard, total 7200
      defaultTrainingScienceConfig,
    );
    expect(dist).not.toBeNull();
    expect(dist!.easyPct).toBeCloseTo((4800 / 7200) * 100);
    expect(dist!.moderatePct).toBeCloseTo((1200 / 7200) * 100);
    expect(dist!.hardPct).toBeCloseTo((1200 / 7200) * 100);
  });

  it("computes deviation from the 80/20 target", () => {
    const dist = computeIntensityDistribution([run({ z1: 8000, z4: 2000 })], defaultTrainingScienceConfig);
    // 80% easy exactly matches target -> deviation ~0
    expect(dist!.deviationPct).toBeCloseTo(0, 1);
  });

  it("flags an under-polarized week (too much moderate/hard) with a negative deviation", () => {
    const dist = computeIntensityDistribution([run({ z1: 3000, z3: 3000, z4: 4000 })], defaultTrainingScienceConfig);
    expect(dist!.deviationPct).toBeLessThan(0);
  });

  it("ignores non-run activities and runs without zone data", () => {
    const activities: Activity[] = [
      run({ z1: 3600 }),
      { ...run(null), sport: "bike" },
      run(null),
    ];
    const dist = computeIntensityDistribution(activities, defaultTrainingScienceConfig);
    expect(dist!.totalSecondsWithZoneData).toBe(3600);
  });

  it("returns null when no run has zone data at all", () => {
    expect(computeIntensityDistribution([run(null)], defaultTrainingScienceConfig)).toBeNull();
    expect(computeIntensityDistribution([], defaultTrainingScienceConfig)).toBeNull();
  });
});
