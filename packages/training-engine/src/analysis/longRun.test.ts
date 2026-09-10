import { describe, expect, it } from "vitest";
import { trackLongRunProgression } from "./longRun";
import type { WeeklyVolumePoint } from "./volume";

describe("trackLongRunProgression", () => {
  it("extracts the long-run distance per week", () => {
    const weeklyVolume: WeeklyVolumePoint[] = [
      { weekStart: "2026-03-02", distanceKm: 30, longRunKm: 15, sessionCount: 3 },
      { weekStart: "2026-03-09", distanceKm: 34, longRunKm: 18, sessionCount: 3 },
    ];
    expect(trackLongRunProgression(weeklyVolume)).toEqual([
      { weekStart: "2026-03-02", longRunKm: 15 },
      { weekStart: "2026-03-09", longRunKm: 18 },
    ]);
  });

  it("returns an empty array for no weeks", () => {
    expect(trackLongRunProgression([])).toEqual([]);
  });
});
