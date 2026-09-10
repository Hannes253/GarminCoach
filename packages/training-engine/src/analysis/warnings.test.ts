import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { Activity } from "../types";
import { computeRollingLoad } from "./load";
import { aggregateWarnings, detectOverreachWarnings } from "./warnings";
import { computeWeeklyVolume } from "./volume";

function run(startTime: string, km: number, hrZoneSeconds: Activity["hrZoneSeconds"] = null): Activity {
  return {
    id: `run-${startTime}`,
    sport: "run",
    startTime,
    durationSeconds: km * 300,
    distanceMeters: km * 1000,
    avgPaceSecPerKm: 300,
    avgHr: 150,
    maxHr: 170,
    hrZoneSeconds,
    elevationGainMeters: null,
    avgCadence: null,
    rpe: null,
  };
}

describe("detectOverreachWarnings", () => {
  it("flags an acute spike after a sudden block of hard training on top of a low chronic base", () => {
    const activities: Activity[] = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(Date.UTC(2026, 2, 1 + day)).toISOString();
      activities.push(run(date, 15, { z4: 4500 }));
    }
    const loadSeries = computeRollingLoad(activities, "2026-03-07", defaultTrainingScienceConfig, 90);
    const warnings = detectOverreachWarnings(loadSeries, defaultTrainingScienceConfig);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe("overreach_acwr");
    expect(warnings[0]?.severity).toBe("critical");
  });

  it("does not flag a steady, well-established training load", () => {
    const activities: Activity[] = [];
    for (let day = 0; day < 90; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString();
      activities.push(run(date, 8, { z2: 2400 }));
    }
    const loadSeries = computeRollingLoad(activities, "2026-03-31", defaultTrainingScienceConfig, 90);
    expect(detectOverreachWarnings(loadSeries, defaultTrainingScienceConfig)).toHaveLength(0);
  });

  it("returns no warning for an empty series", () => {
    expect(detectOverreachWarnings([], defaultTrainingScienceConfig)).toHaveLength(0);
  });
});

describe("aggregateWarnings", () => {
  it("combines ramp-rate and overreach warnings", () => {
    const weeklyVolume = computeWeeklyVolume([
      run("2026-03-02T07:00:00Z", 20),
      run("2026-03-09T07:00:00Z", 30), // +50%, exceeds ramp rate
    ]);
    const warnings = aggregateWarnings(weeklyVolume, [], defaultTrainingScienceConfig);
    expect(warnings.some((w) => w.code === "ramp_rate_exceeded")).toBe(true);
  });
});
