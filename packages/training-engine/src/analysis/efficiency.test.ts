import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { Activity } from "../types";
import { computeAerobicEfficiencyTrend } from "./efficiency";

function easyRun(date: string, paceSecPerKm: number, avgHr: number): Activity {
  return {
    id: `run-${date}`,
    sport: "run",
    startTime: `${date}T07:00:00.000Z`,
    durationSeconds: 3600,
    distanceMeters: 10000,
    avgPaceSecPerKm: paceSecPerKm,
    avgHr,
    maxHr: avgHr + 15,
    hrZoneSeconds: { z1: 1200, z2: 2400 }, // fully easy
    elevationGainMeters: null,
    avgCadence: null,
    rpe: null,
  };
}

describe("computeAerobicEfficiencyTrend", () => {
  it("computes a higher efficiency factor for faster pace at the same HR", () => {
    const points = computeAerobicEfficiencyTrend(
      [easyRun("2026-01-01", 360, 140), easyRun("2026-02-01", 330, 140)],
      defaultTrainingScienceConfig,
    );
    expect(points).toHaveLength(2);
    expect(points[1]!.efficiencyFactor).toBeGreaterThan(points[0]!.efficiencyFactor);
  });

  it("returns points sorted chronologically regardless of input order", () => {
    const points = computeAerobicEfficiencyTrend(
      [easyRun("2026-03-01", 360, 140), easyRun("2026-01-01", 360, 140)],
      defaultTrainingScienceConfig,
    );
    expect(points.map((p) => p.date)).toEqual(["2026-01-01", "2026-03-01"]);
  });

  it("excludes a run that was mostly hard effort, not comparable to easy runs", () => {
    const hardRun: Activity = {
      ...easyRun("2026-01-01", 300, 170),
      hrZoneSeconds: { z4: 1800, z5: 1800 },
    };
    const points = computeAerobicEfficiencyTrend([hardRun], defaultTrainingScienceConfig);
    expect(points).toHaveLength(0);
  });

  it("excludes runs with no HR-zone breakdown at all", () => {
    const noZoneData: Activity = { ...easyRun("2026-01-01", 360, 140), hrZoneSeconds: null };
    expect(computeAerobicEfficiencyTrend([noZoneData], defaultTrainingScienceConfig)).toHaveLength(0);
  });

  it("excludes non-run activities", () => {
    const bike: Activity = { ...easyRun("2026-01-01", 360, 140), sport: "bike" };
    expect(computeAerobicEfficiencyTrend([bike], defaultTrainingScienceConfig)).toHaveLength(0);
  });
});
