import { describe, expect, it } from "vitest";
import { mergeActivity, type ExistingActivity } from "./mergeActivity";
import type { NormalizedActivityInput } from "./types";

function activity(overrides: Partial<NormalizedActivityInput> = {}): NormalizedActivityInput {
  return {
    sport: "run",
    subSport: null,
    startTime: "2026-03-01T07:00:00.000Z",
    durationSeconds: 1800,
    distanceMeters: 5000,
    avgPaceSecPerKm: 360,
    avgHr: 150,
    maxHr: 170,
    hrZoneSeconds: null,
    elevationGainMeters: 20,
    avgCadence: 170,
    calories: 300,
    ...overrides,
  };
}

describe("mergeActivity", () => {
  it("imports a brand-new activity as-is", () => {
    const result = mergeActivity(null, activity(), "fit");
    expect(result.status).toBe("imported");
    expect(result.source).toBe("fit");
    expect(result.merged).toEqual(activity());
  });

  it("re-importing the exact same FIT file is a no-op duplicate", () => {
    const existing: ExistingActivity = { ...activity(), source: "fit" };
    const result = mergeActivity(existing, activity(), "fit");
    expect(result.status).toBe("duplicate_skipped");
    expect(result.source).toBe("fit");
  });

  it("CSV data never overwrites richer existing FIT data", () => {
    const existing: ExistingActivity = {
      ...activity({ hrZoneSeconds: { z1: 900 }, avgCadence: 172 }),
      source: "fit",
    };
    const csvIncoming = activity({ hrZoneSeconds: null, avgCadence: null, avgHr: 148 });

    const result = mergeActivity(existing, csvIncoming, "csv");

    expect(result.source).toBe("fit");
    expect(result.merged.hrZoneSeconds).toEqual({ z1: 900 });
    expect(result.merged.avgCadence).toBe(172);
    // CSV's avgHr differs from existing but FIT still wins on conflicting fields
    expect(result.merged.avgHr).toBe(150);
  });

  it("a later FIT import enriches an existing CSV-only row with fields CSV lacked", () => {
    const existing: ExistingActivity = {
      ...activity({ hrZoneSeconds: null, avgCadence: null, elevationGainMeters: null }),
      source: "csv",
    };
    const fitIncoming = activity({
      hrZoneSeconds: { z1: 900, z2: 600 },
      avgCadence: 171,
      elevationGainMeters: 25,
    });

    const result = mergeActivity(existing, fitIncoming, "fit");

    expect(result.status).toBe("enriched_existing");
    expect(result.source).toBe("fit");
    expect(result.merged.hrZoneSeconds).toEqual({ z1: 900, z2: 600 });
    expect(result.merged.avgCadence).toBe(171);
    expect(result.merged.elevationGainMeters).toBe(25);
  });

  it("CSV can still fill gaps a sparser existing FIT row left null, without becoming the source of record", () => {
    const existing: ExistingActivity = { ...activity({ calories: null }), source: "fit" };
    const csvIncoming = activity({ calories: 310 });

    const result = mergeActivity(existing, csvIncoming, "csv");

    expect(result.status).toBe("enriched_existing");
    expect(result.source).toBe("fit");
    expect(result.merged.calories).toBe(310);
  });

  it("never lets a CSV import be recorded as a lower-priority source than the existing FIT row", () => {
    const existing: ExistingActivity = { ...activity(), source: "fit" };
    const result = mergeActivity(existing, activity({ avgHr: 999 }), "csv");
    expect(result.source).toBe("fit");
  });
});
