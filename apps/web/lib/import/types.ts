export type ImportSport = "run" | "bike" | "strength" | "other";

/**
 * The shape both the FIT and CSV import paths normalize into, before
 * source/dedup metadata is attached and the row is sent to Supabase. Mirrors
 * the relevant columns of the `activities` table (see
 * supabase/migrations/0001_init.sql).
 */
export interface NormalizedActivityInput {
  sport: ImportSport;
  subSport: string | null;
  startTime: string; // ISO 8601
  durationSeconds: number;
  distanceMeters: number | null;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  maxHr: number | null;
  hrZoneSeconds: Record<string, number> | null;
  elevationGainMeters: number | null;
  avgCadence: number | null;
  calories: number | null;
}

export type ImportItemStatus = "imported" | "duplicate_skipped" | "enriched_existing" | "error";

export interface ImportItemResult {
  itemName: string;
  fileHash: string | null;
  dedupKey: string | null;
  status: ImportItemStatus;
  error?: string;
}

export interface ImportProgressEvent {
  phase: "parsing" | "uploading";
  processed: number;
  total: number;
  currentFile: string;
}
