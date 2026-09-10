import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { Activity } from "../types";
import { classifyForm, computeActivityLoad, computeRollingLoad } from "./load";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    sport: "run",
    startTime: "2026-03-01T07:00:00.000Z",
    durationSeconds: 3600,
    distanceMeters: 10000,
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

describe("computeActivityLoad", () => {
  it("sums zone-weighted minutes when a HR-zone breakdown exists", () => {
    // 10 min z1 (x1) + 20 min z2 (x2) + 30 min z3 (x3) = 10 + 40 + 90 = 140
    const load = computeActivityLoad(
      activity({ hrZoneSeconds: { z1: 600, z2: 1200, z3: 1800 } }),
      defaultTrainingScienceConfig,
    );
    expect(load).toBeCloseTo(140);
  });

  it("folds an out-of-range z0 (time below zone 1) into the z1 weight", () => {
    // z0 isn't part of the strict HrZoneId type, but a raw device zone
    // breakdown can still contain it - hence the cast, and hence the test.
    const withZ0 = computeActivityLoad(
      activity({ hrZoneSeconds: { z0: 300, z1: 300 } as Activity["hrZoneSeconds"] }),
      defaultTrainingScienceConfig,
    );
    const allZ1 = computeActivityLoad(activity({ hrZoneSeconds: { z1: 600 } }), defaultTrainingScienceConfig);
    expect(withZ0).toBeCloseTo(allZ1);
  });

  it("falls back to duration x neutral factor when no zone data exists", () => {
    const load = computeActivityLoad(activity({ hrZoneSeconds: null }), defaultTrainingScienceConfig);
    expect(load).toBeCloseTo(60 * defaultTrainingScienceConfig.loadModel.noZoneDataFallbackFactor);
  });

  it("uses session-RPE x duration for strength training", () => {
    const load = computeActivityLoad(
      activity({ sport: "strength", durationSeconds: 2400, rpe: 6, hrZoneSeconds: null }),
      defaultTrainingScienceConfig,
    );
    expect(load).toBeCloseTo(6 * 40);
  });

  it("returns 0 load for strength training with no RPE logged", () => {
    const load = computeActivityLoad(
      activity({ sport: "strength", durationSeconds: 2400, rpe: null }),
      defaultTrainingScienceConfig,
    );
    expect(load).toBe(0);
  });
});

describe("computeRollingLoad", () => {
  it("returns one point per day across the lookback window plus today", () => {
    const points = computeRollingLoad([], "2026-03-10", defaultTrainingScienceConfig, 10);
    expect(points).toHaveLength(11);
    expect(points[0]?.date).toBe("2026-02-28");
    expect(points.at(-1)?.date).toBe("2026-03-10");
  });

  it("ATL and CTL both climb toward a sustained daily load, ATL faster than CTL", () => {
    const activities: Activity[] = [];
    for (let day = 0; day < 60; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString();
      activities.push(activity({ id: `run-${day}`, startTime: date, hrZoneSeconds: { z2: 3600 } }));
    }
    const points = computeRollingLoad(activities, "2026-03-02", defaultTrainingScienceConfig, 60);
    const last = points.at(-1)!;

    // constant daily load of 120 (60 min x weight 2) - ATL converges faster
    expect(last.atl).toBeGreaterThan(last.ctl);
    expect(last.atl).toBeLessThanOrEqual(120);
    expect(last.ctl).toBeLessThan(last.atl);
  });

  it("TSB goes negative during a hard training block and recovers on rest days", () => {
    const activities: Activity[] = [];
    for (let day = 0; day < 20; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString();
      activities.push(activity({ id: `hard-${day}`, startTime: date, hrZoneSeconds: { z4: 3600 } }));
    }
    const points = computeRollingLoad(activities, "2026-02-10", defaultTrainingScienceConfig, 40);

    const duringBlock = points.find((p) => p.date === "2026-01-18")!;
    const afterRest = points.at(-1)!;

    expect(duringBlock.tsb).toBeLessThan(0);
    expect(afterRest.tsb).toBeGreaterThan(duringBlock.tsb);
  });

  it("all-zero when there are no activities in the window", () => {
    const points = computeRollingLoad([], "2026-03-10", defaultTrainingScienceConfig, 5);
    expect(points.every((p) => p.load === 0 && p.atl === 0 && p.ctl === 0 && p.tsb === 0)).toBe(true);
  });
});

describe("classifyForm", () => {
  it("buckets TSB values into the configured form-status bands", () => {
    expect(classifyForm(10, defaultTrainingScienceConfig)).toBe("fresh");
    expect(classifyForm(0, defaultTrainingScienceConfig)).toBe("neutral");
    expect(classifyForm(-20, defaultTrainingScienceConfig)).toBe("fatigued");
    expect(classifyForm(-40, defaultTrainingScienceConfig)).toBe("very_fatigued");
  });
});
