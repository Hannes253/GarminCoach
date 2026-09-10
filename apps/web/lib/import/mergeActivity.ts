import type { NormalizedActivityInput } from "./types";

export type ActivitySource = "fit" | "csv" | "manual" | "strava";

// Strava-relayed activities carry HR/cadence/elevation (richer than the
// plain CSV export) but not the FIT file's per-zone HR breakdown, so they
// rank between the two.
const SOURCE_PRIORITY: Record<ActivitySource, number> = { fit: 4, strava: 3, csv: 2, manual: 1 };

const MERGEABLE_FIELDS = [
  "sport",
  "subSport",
  "startTime",
  "durationSeconds",
  "distanceMeters",
  "avgPaceSecPerKm",
  "avgHr",
  "maxHr",
  "hrZoneSeconds",
  "elevationGainMeters",
  "avgCadence",
  "calories",
] as const satisfies readonly (keyof NormalizedActivityInput)[];

export interface ExistingActivity extends NormalizedActivityInput {
  source: ActivitySource;
}

export interface MergeResult {
  merged: NormalizedActivityInput;
  source: ActivitySource;
  status: "imported" | "duplicate_skipped" | "enriched_existing";
}

/**
 * Merges a newly-imported activity into a possibly-existing row with the
 * same dedup_key. Higher-fidelity sources (FIT > CSV > manual) win on
 * conflicting fields; either side fills gaps the other left null. Existing
 * `activity_manual_fields`/`daily_log` data is never touched here - this
 * only concerns the `activities` row itself.
 */
export function mergeActivity(
  existing: ExistingActivity | null,
  incoming: NormalizedActivityInput,
  incomingSource: ActivitySource,
): MergeResult {
  if (!existing) {
    return { merged: incoming, source: incomingSource, status: "imported" };
  }

  const incomingWins = SOURCE_PRIORITY[incomingSource] >= SOURCE_PRIORITY[existing.source];
  const primary = incomingWins ? incoming : existing;
  const secondary = incomingWins ? existing : incoming;

  const merged: Partial<NormalizedActivityInput> = {};
  let changed = false;

  for (const field of MERGEABLE_FIELDS) {
    const value = primary[field] ?? secondary[field] ?? null;
    merged[field] = value as never;
    if (value !== (existing[field] ?? null)) changed = true;
  }

  return {
    merged: merged as NormalizedActivityInput,
    source: incomingWins ? incomingSource : existing.source,
    status: changed ? "enriched_existing" : "duplicate_skipped",
  };
}
