import "server-only";
import type { Activity } from "@garmincoach/training-engine";
import { rowToEngineActivity } from "@/lib/mappers/activity";
import { createClient } from "@/lib/supabase/server";

/**
 * Loads the signed-in user's activities (merged with their RPE from
 * activity_manual_fields) as training-engine domain objects, ready for the
 * analysis/* functions. Server-only - uses the cookie-based server Supabase
 * client, never import this from a client component.
 */
export async function loadEngineActivities(limit = 500): Promise<Activity[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: activities }, { data: manualFields }] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, sport, start_time, duration_seconds, distance_meters, avg_pace_sec_per_km, avg_hr, max_hr, hr_zone_seconds, elevation_gain_meters, avg_cadence",
      )
      .eq("user_id", user.id)
      .order("start_time", { ascending: true })
      .limit(limit),
    supabase.from("activity_manual_fields").select("activity_id, rpe").eq("user_id", user.id),
  ]);

  const rpeByActivityId = new Map((manualFields ?? []).map((m) => [m.activity_id, m.rpe]));

  return (activities ?? []).map((row) => rowToEngineActivity(row, rpeByActivityId.get(row.id) ?? null));
}
