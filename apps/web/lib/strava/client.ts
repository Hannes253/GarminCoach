import type { NormalizedActivityInput } from "@/lib/import/types";

const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
}

async function postToken(body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava OAuth request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function exchangeCodeForTokens(code: string): Promise<StravaTokens & { athleteId: number }> {
  const data = await postToken({ code, grant_type: "authorization_code" });
  const athlete = data.athlete as { id: number };
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: data.expires_at as number,
    athleteId: athlete.id,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
  const data = await postToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: data.expires_at as number,
  };
}

export interface StravaActivity {
  type: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  average_cadence?: number;
  calories?: number;
}

export async function fetchStravaActivity(activityId: number, accessToken: string): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava activity fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

interface StravaZoneDistributionBucket {
  min: number;
  max: number;
  time: number; // seconds
}

interface StravaZoneSet {
  type: string; // "heartrate" | "pace"
  distribution_buckets: StravaZoneDistributionBucket[];
}

/**
 * Strava's per-activity zone breakdown, a separate endpoint from the
 * activity itself. Only populated if the athlete has HR zones configured in
 * their Strava account; a 401/403/404 just means "no zone data for this
 * activity", not a hard failure, so callers should treat a thrown error the
 * same way (best-effort enrichment, not required for ingestion).
 */
export async function fetchStravaActivityZones(activityId: number, accessToken: string): Promise<StravaZoneSet[]> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}/zones`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Maps Strava's ordered heart-rate distribution buckets onto the same
 * "z0", "z1", ... shape normalize.ts's FIT path produces from
 * timeInHrZone (index 0 = below zone 1) - Strava's buckets are the
 * athlete's own configured zones, in ascending order, same convention.
 * Not yet cross-checked against a real multi-zone Strava account; re-verify
 * once real data is available (same caveat as avgCadence below).
 */
export function hrZoneSecondsFromStravaZones(zones: StravaZoneSet[]): Record<string, number> | null {
  const hr = zones.find((z) => z.type === "heartrate");
  if (!hr || hr.distribution_buckets.length === 0) return null;
  return Object.fromEntries(hr.distribution_buckets.map((bucket, i) => [`z${i}`, bucket.time]));
}

function mapStravaSport(type: string): NormalizedActivityInput["sport"] {
  const t = type.toLowerCase();
  if (t.includes("run")) return "run";
  if (t.includes("ride") || t.includes("cycl")) return "bike";
  if (t.includes("weighttraining") || t.includes("workout") || t.includes("strength") || t.includes("crosstraining")) {
    return "strength";
  }
  return "other";
}

function paceSecPerKm(durationSeconds: number, distanceMeters: number | null): number | null {
  if (!distanceMeters || distanceMeters <= 0) return null;
  return Math.round((durationSeconds / distanceMeters) * 1000);
}

export function normalizeStravaActivity(activity: StravaActivity): NormalizedActivityInput {
  const durationSeconds = activity.moving_time || activity.elapsed_time;
  const distanceMeters = activity.distance || null;

  return {
    sport: mapStravaSport(activity.sport_type || activity.type),
    subSport: activity.sport_type ?? activity.type ?? null,
    startTime: new Date(activity.start_date).toISOString(),
    durationSeconds,
    distanceMeters,
    avgPaceSecPerKm: paceSecPerKm(durationSeconds, distanceMeters),
    avgHr: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
    maxHr: activity.max_heartrate != null ? Math.round(activity.max_heartrate) : null,
    // Strava's detailed-activity endpoint doesn't include a per-zone HR
    // breakdown (that needs the separate /activities/{id}/zones endpoint,
    // not fetched here) - only the FIT import path fills hrZoneSeconds.
    hrZoneSeconds: null,
    elevationGainMeters: activity.total_elevation_gain ?? null,
    // TODO(verify with real data): Strava's average_cadence for runs may be
    // single-leg (half of Garmin's FIT-reported running cadence). Passed
    // through as-is for now - re-check once real Strava-vs-FIT data for the
    // same run is available, per the project's rule to flag unverified
    // training-data assumptions.
    avgCadence: activity.average_cadence != null ? Math.round(activity.average_cadence) : null,
    calories: activity.calories != null ? Math.round(activity.calories) : null,
  };
}
