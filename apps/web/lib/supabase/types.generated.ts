/**
 * Hand-written placeholder matching supabase/migrations/0001_init.sql.
 *
 * Once the Supabase project exists and the CLI is linked, replace this file
 * by running:
 *   supabase gen types typescript --linked > lib/supabase/types.generated.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string;
          race_date: string | null;
          race_name: string | null;
          current_plan_id: string | null;
          seed_pace_zones: Json | null;
          seed_hr_zones: Json | null;
          hr_max: number | null;
          hr_rest: number | null;
          threshold_pace_sec_per_km: number | null;
          zone_methodology: string | null;
          timezone: string;
          units: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_settings"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Row"]>;
        Relationships: [];
      };
      import_batches: {
        Row: {
          id: string;
          user_id: string;
          source_type: "fit_zip" | "csv";
          file_name: string;
          file_hash: string;
          status: "processing" | "completed" | "failed";
          activity_count: number;
          error_log: Json | null;
          imported_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["import_batches"]["Row"]> & {
          user_id: string;
          source_type: "fit_zip" | "csv";
          file_name: string;
          file_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_batches"]["Row"]>;
        Relationships: [];
      };
      import_batch_items: {
        Row: {
          id: string;
          user_id: string;
          import_batch_id: string;
          item_name: string;
          file_hash: string | null;
          dedup_key: string | null;
          status: "imported" | "duplicate_skipped" | "enriched_existing" | "error";
          activity_id: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["import_batch_items"]["Row"]> & {
          user_id: string;
          import_batch_id: string;
          item_name: string;
          status: "imported" | "duplicate_skipped" | "enriched_existing" | "error";
        };
        Update: Partial<Database["public"]["Tables"]["import_batch_items"]["Row"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          source: "fit" | "csv" | "manual";
          sport: "run" | "bike" | "strength" | "other";
          sub_sport: string | null;
          dedup_key: string;
          file_hash: string | null;
          start_time: string;
          duration_seconds: number;
          distance_meters: number | null;
          avg_pace_sec_per_km: number | null;
          avg_hr: number | null;
          max_hr: number | null;
          hr_zone_seconds: Json | null;
          elevation_gain_meters: number | null;
          avg_cadence: number | null;
          calories: number | null;
          source_import_batch_id: string | null;
          source_item_id: string | null;
          raw_summary: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activities"]["Row"]> & {
          user_id: string;
          source: "fit" | "csv" | "manual";
          sport: "run" | "bike" | "strength" | "other";
          dedup_key: string;
          start_time: string;
          duration_seconds: number;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Row"]>;
        Relationships: [];
      };
      activity_manual_fields: {
        Row: {
          id: string;
          user_id: string;
          activity_id: string;
          rpe: number | null;
          note: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activity_manual_fields"]["Row"]> & {
          user_id: string;
          activity_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_manual_fields"]["Row"]>;
        Relationships: [];
      };
      daily_log: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          sleep_hours: number | null;
          sleep_quality: number | null;
          note: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_log"]["Row"]> & {
          user_id: string;
          log_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_log"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
