import type { ImportSport, NormalizedActivityInput } from "./types";

function mapFitSport(sport: string | undefined, subSport: string | undefined): ImportSport {
  if (sport === "running") return "run";
  if (sport === "cycling") return "bike";
  if (sport === "training" || subSport === "strength_training") return "strength";
  return "other";
}

function paceSecPerKm(durationSeconds: number, distanceMeters: number | null): number | null {
  if (!distanceMeters || distanceMeters <= 0) return null;
  return Math.round((durationSeconds / distanceMeters) * 1000);
}

/**
 * The subset of a decoded FIT `session` message this app reads. The FIT SDK
 * itself is loosely typed (decoded fields come back as a dynamic object), so
 * this interface documents only the fields normalize.ts consumes.
 */
export interface FitSessionMesg {
  sport?: string;
  subSport?: string;
  startTime?: Date | string;
  totalTimerTime?: number; // seconds, excludes pauses
  totalElapsedTime?: number; // seconds, includes pauses
  totalDistance?: number; // meters
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  totalAscent?: number; // meters
  totalCalories?: number;
  timeInHrZone?: number[]; // seconds per device HR zone, index 0 = below zone 1
}

export function normalizeFitSession(session: FitSessionMesg): NormalizedActivityInput | null {
  if (!session.startTime) return null;

  const durationSeconds = session.totalTimerTime ?? session.totalElapsedTime;
  if (!durationSeconds || durationSeconds <= 0) return null;

  const distanceMeters = session.totalDistance ?? null;
  const hrZoneSeconds =
    session.timeInHrZone && session.timeInHrZone.length > 0
      ? Object.fromEntries(session.timeInHrZone.map((seconds, i) => [`z${i}`, seconds]))
      : null;

  return {
    sport: mapFitSport(session.sport, session.subSport),
    subSport: session.subSport ?? null,
    startTime: new Date(session.startTime).toISOString(),
    durationSeconds,
    distanceMeters,
    avgPaceSecPerKm: paceSecPerKm(durationSeconds, distanceMeters),
    avgHr: session.avgHeartRate ?? null,
    maxHr: session.maxHeartRate ?? null,
    hrZoneSeconds,
    elevationGainMeters: session.totalAscent ?? null,
    avgCadence: session.avgCadence ?? null,
    calories: session.totalCalories ?? null,
  };
}

/**
 * The subset of columns this app reads from Garmin Connect's "Activities"
 * CSV export. Confirmed against a real export during Phase 1 - column names
 * and units are stable across a single Garmin Connect locale/session but
 * unofficial, so re-check against a fresh export if this stops matching.
 */
export interface GarminCsvRow {
  "Activity Type"?: string;
  Date?: string;
  "Elapsed Time"?: string; // "H:MM:SS" or "MM:SS"
  Distance?: string; // km, e.g. "10.05"
  "Avg HR"?: string;
  "Max HR"?: string;
  "Avg Run Cadence"?: string;
  "Total Ascent"?: string; // meters
  Calories?: string;
}

function mapCsvSport(activityType: string | undefined): ImportSport {
  const type = (activityType ?? "").toLowerCase();
  if (type.includes("run")) return "run";
  if (type.includes("cycling") || type.includes("biking")) return "bike";
  if (type.includes("strength") || type.includes("training")) return "strength";
  return "other";
}

function parseElapsedTimeToSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value === "--") return null;
  const n = Number(value.replace(",", ""));
  return Number.isNaN(n) ? null : n;
}

export function normalizeCsvRow(row: GarminCsvRow): NormalizedActivityInput | null {
  if (!row.Date) return null;

  const durationSeconds = parseElapsedTimeToSeconds(row["Elapsed Time"]);
  if (!durationSeconds || durationSeconds <= 0) return null;

  const distanceKm = parseNumber(row.Distance);
  const distanceMeters = distanceKm != null ? Math.round(distanceKm * 1000) : null;

  return {
    sport: mapCsvSport(row["Activity Type"]),
    subSport: row["Activity Type"] ?? null,
    startTime: new Date(row.Date).toISOString(),
    durationSeconds,
    distanceMeters,
    avgPaceSecPerKm: paceSecPerKm(durationSeconds, distanceMeters),
    avgHr: parseNumber(row["Avg HR"]),
    maxHr: parseNumber(row["Max HR"]),
    hrZoneSeconds: null, // not present in the CSV export
    elevationGainMeters: parseNumber(row["Total Ascent"]),
    avgCadence: parseNumber(row["Avg Run Cadence"]),
    calories: parseNumber(row.Calories),
  };
}
