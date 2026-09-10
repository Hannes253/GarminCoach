import { describe, expect, it } from "vitest";
import { normalizeFitSession, normalizeCsvRow } from "./normalize";

describe("normalizeFitSession", () => {
  it("maps a running session to the unified Activity shape", () => {
    const result = normalizeFitSession({
      sport: "running",
      subSport: "generic",
      startTime: new Date("2026-03-01T07:00:00Z"),
      totalTimerTime: 1800,
      totalDistance: 5000,
      avgHeartRate: 150,
      maxHeartRate: 172,
      avgCadence: 170,
      totalAscent: 20,
      totalCalories: 320,
      timeInHrZone: [60, 900, 600, 200, 40],
    });

    expect(result).toMatchObject({
      sport: "run",
      durationSeconds: 1800,
      distanceMeters: 5000,
      avgPaceSecPerKm: 360,
      avgHr: 150,
      maxHr: 172,
      elevationGainMeters: 20,
      avgCadence: 170,
      calories: 320,
    });
    expect(result?.hrZoneSeconds).toEqual({ z0: 60, z1: 900, z2: 600, z3: 200, z4: 40 });
  });

  it("maps Garmin strength-training sessions to sport 'strength'", () => {
    const result = normalizeFitSession({
      sport: "training",
      subSport: "strength_training",
      startTime: new Date("2026-03-01T07:00:00Z"),
      totalTimerTime: 2400,
    });
    expect(result?.sport).toBe("strength");
    expect(result?.distanceMeters).toBeNull();
    expect(result?.avgPaceSecPerKm).toBeNull();
  });

  it("falls back to totalElapsedTime when totalTimerTime is missing", () => {
    const result = normalizeFitSession({
      sport: "cycling",
      startTime: new Date("2026-03-01T07:00:00Z"),
      totalElapsedTime: 3600,
    });
    expect(result?.sport).toBe("bike");
    expect(result?.durationSeconds).toBe(3600);
  });

  it("returns null for a session with no usable duration", () => {
    expect(normalizeFitSession({ sport: "running", startTime: new Date() })).toBeNull();
  });

  it("returns null for a session with no start time", () => {
    expect(normalizeFitSession({ sport: "running", totalTimerTime: 1800 })).toBeNull();
  });
});

describe("normalizeCsvRow", () => {
  it("maps a typical Garmin Activities CSV row", () => {
    const result = normalizeCsvRow({
      "Activity Type": "Running",
      Date: "2026-03-01 07:00:00",
      "Elapsed Time": "0:30:00",
      Distance: "5.00",
      "Avg HR": "150",
      "Max HR": "172",
      "Avg Run Cadence": "170",
      "Total Ascent": "20",
      Calories: "320",
    });

    expect(result).toMatchObject({
      sport: "run",
      durationSeconds: 1800,
      distanceMeters: 5000,
      avgPaceSecPerKm: 360,
      avgHr: 150,
      maxHr: 172,
      elevationGainMeters: 20,
      avgCadence: 170,
      calories: 320,
    });
    expect(result?.hrZoneSeconds).toBeNull();
  });

  it("parses H:MM:SS elapsed time", () => {
    const result = normalizeCsvRow({
      "Activity Type": "Running",
      Date: "2026-03-01 07:00:00",
      "Elapsed Time": "1:05:30",
      Distance: "15.00",
    });
    expect(result?.durationSeconds).toBe(3930);
  });

  it("treats '--' placeholders as missing values", () => {
    const result = normalizeCsvRow({
      "Activity Type": "Strength Training",
      Date: "2026-03-01 07:00:00",
      "Elapsed Time": "0:40:00",
      Distance: "--",
      "Avg HR": "--",
    });
    expect(result?.sport).toBe("strength");
    expect(result?.distanceMeters).toBeNull();
    expect(result?.avgHr).toBeNull();
  });

  it("returns null when the row has no date", () => {
    expect(normalizeCsvRow({ "Elapsed Time": "0:30:00" })).toBeNull();
  });

  it("returns null when elapsed time is missing or zero", () => {
    expect(normalizeCsvRow({ Date: "2026-03-01 07:00:00" })).toBeNull();
  });
});
