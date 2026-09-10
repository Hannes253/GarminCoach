import { describe, expect, it } from "vitest";
import { computeDedupKey, sha256Hex } from "./dedupKey";
import type { NormalizedActivityInput } from "./types";

function activity(overrides: Partial<NormalizedActivityInput> = {}): NormalizedActivityInput {
  return {
    sport: "run",
    subSport: null,
    startTime: "2026-03-01T07:00:03.500Z",
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

describe("computeDedupKey", () => {
  it("produces the same key for the same activity described with sub-second precision differences", () => {
    const a = computeDedupKey(activity({ startTime: "2026-03-01T07:00:03.500Z" }));
    const b = computeDedupKey(activity({ startTime: "2026-03-01T07:00:00.000Z" }));
    expect(a).toBe(b);
  });

  it("collapses FIT-precision and CSV-rounded duration/distance to the same key", () => {
    const fit = computeDedupKey(
      activity({ durationSeconds: 1802, distanceMeters: 5004, startTime: "2026-03-01T07:00:00Z" }),
    );
    const csv = computeDedupKey(
      activity({ durationSeconds: 1800, distanceMeters: 5000, startTime: "2026-03-01T07:00:04Z" }),
    );
    expect(fit).toBe(csv);
  });

  it("produces different keys for different start times", () => {
    const a = computeDedupKey(activity({ startTime: "2026-03-01T07:00:00Z" }));
    const b = computeDedupKey(activity({ startTime: "2026-03-01T08:00:00Z" }));
    expect(a).not.toBe(b);
  });

  it("produces different keys for different sports at the same time", () => {
    const run = computeDedupKey(activity({ sport: "run" }));
    const bike = computeDedupKey(activity({ sport: "bike" }));
    expect(run).not.toBe(bike);
  });

  it("handles a null distance (e.g. strength training) without throwing", () => {
    expect(() => computeDedupKey(activity({ sport: "strength", distanceMeters: null }))).not.toThrow();
  });
});

describe("sha256Hex", () => {
  it("is deterministic for the same bytes", async () => {
    const bytes = new TextEncoder().encode("hello fit file");
    const a = await sha256Hex(bytes);
    const b = await sha256Hex(bytes);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different bytes", async () => {
    const a = await sha256Hex(new TextEncoder().encode("a"));
    const b = await sha256Hex(new TextEncoder().encode("b"));
    expect(a).not.toBe(b);
  });
});
