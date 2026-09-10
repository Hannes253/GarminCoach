import type { Activity as EngineActivity } from "@garmincoach/training-engine";
import type { ActivitySource } from "@/lib/import/mergeActivity";
import type { NormalizedActivityInput } from "@/lib/import/types";
import type { Database } from "@/lib/supabase/types.generated";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];

export type ExistingActivityRow = Pick<
  ActivityRow,
  | "dedup_key"
  | "source"
  | "sport"
  | "sub_sport"
  | "start_time"
  | "duration_seconds"
  | "distance_meters"
  | "avg_pace_sec_per_km"
  | "avg_hr"
  | "max_hr"
  | "hr_zone_seconds"
  | "elevation_gain_meters"
  | "avg_cadence"
  | "calories"
>;

export function rowToActivityInput(
  row: ExistingActivityRow,
): NormalizedActivityInput & { source: ActivitySource } {
  return {
    sport: row.sport as NormalizedActivityInput["sport"],
    subSport: row.sub_sport,
    startTime: row.start_time,
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    avgPaceSecPerKm: row.avg_pace_sec_per_km,
    avgHr: row.avg_hr,
    maxHr: row.max_hr,
    hrZoneSeconds: row.hr_zone_seconds as Record<string, number> | null,
    elevationGainMeters: row.elevation_gain_meters,
    avgCadence: row.avg_cadence,
    calories: row.calories,
    source: row.source as ActivitySource,
  };
}

export type EngineActivityRow = Pick<
  ActivityRow,
  | "id"
  | "sport"
  | "start_time"
  | "duration_seconds"
  | "distance_meters"
  | "avg_pace_sec_per_km"
  | "avg_hr"
  | "max_hr"
  | "hr_zone_seconds"
  | "elevation_gain_meters"
  | "avg_cadence"
>;

/**
 * Maps a Supabase activities row (+ its RPE, fetched separately from
 * activity_manual_fields since our hand-written Database type doesn't model
 * the join) into the training-engine's domain Activity type, for the
 * analysis/* functions.
 */
export function rowToEngineActivity(row: EngineActivityRow, rpe: number | null): EngineActivity {
  return {
    id: row.id,
    sport: row.sport as EngineActivity["sport"],
    startTime: row.start_time,
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    avgPaceSecPerKm: row.avg_pace_sec_per_km,
    avgHr: row.avg_hr,
    maxHr: row.max_hr,
    hrZoneSeconds: row.hr_zone_seconds as EngineActivity["hrZoneSeconds"],
    elevationGainMeters: row.elevation_gain_meters,
    avgCadence: row.avg_cadence,
    rpe,
  };
}

export function activityInputToInsert(params: {
  activity: NormalizedActivityInput;
  source: ActivitySource;
  dedupKey: string;
  userId: string;
  importBatchId: string | null;
  fileHash: string | null;
}): ActivityInsert {
  const { activity, source, dedupKey, userId, importBatchId, fileHash } = params;
  return {
    user_id: userId,
    source,
    sport: activity.sport,
    sub_sport: activity.subSport,
    dedup_key: dedupKey,
    file_hash: fileHash,
    start_time: activity.startTime,
    duration_seconds: activity.durationSeconds,
    distance_meters: activity.distanceMeters,
    avg_pace_sec_per_km: activity.avgPaceSecPerKm,
    avg_hr: activity.avgHr,
    max_hr: activity.maxHr,
    hr_zone_seconds: activity.hrZoneSeconds,
    elevation_gain_meters: activity.elevationGainMeters,
    avg_cadence: activity.avgCadence,
    calories: activity.calories,
    source_import_batch_id: importBatchId,
  };
}
