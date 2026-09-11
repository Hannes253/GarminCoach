import { NextResponse } from "next/server";
import { computeDedupKey } from "@/lib/import/dedupKey";
import { mergeActivity } from "@/lib/import/mergeActivity";
import { activityInputToInsert, rowToActivityInput, type ExistingActivityRow } from "@/lib/mappers/activity";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchStravaActivity,
  fetchStravaActivityZones,
  hrZoneSecondsFromStravaZones,
  normalizeStravaActivity,
  refreshAccessToken,
} from "@/lib/strava/client";

/**
 * One-time subscription verification handshake. Strava calls this with
 * hub.mode/hub.verify_token/hub.challenge when a push subscription is
 * created (see the setup instructions for the exact curl command) and
 * expects the challenge echoed back if the verify token matches.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

interface StravaWebhookEvent {
  aspect_type: "create" | "update" | "delete";
  object_type: "activity" | "athlete";
  object_id: number;
  owner_id: number;
}

/**
 * Receives new-activity notifications. Runs with the service-role client
 * (see lib/supabase/service.ts) since there is no user session in a webhook
 * request - every query below filters by athlete_id/user_id explicitly to
 * compensate for RLS not applying here.
 *
 * Always responds 200 once the event is understood (even on a processing
 * error) so Strava doesn't retry indefinitely; only unrecognized event
 * shapes would be worth surfacing, and those still can't do anything useful
 * with a retry either.
 */
export async function POST(request: Request) {
  const event = (await request.json()) as StravaWebhookEvent;

  if (event.object_type !== "activity" || event.aspect_type !== "create") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  const { data: connection } = await supabase
    .from("strava_connection")
    .select("user_id, access_token, refresh_token, expires_at")
    .eq("athlete_id", event.owner_id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ ok: true }); // not our connected athlete
  }

  let accessToken = connection.access_token;
  if (new Date(connection.expires_at).getTime() <= Date.now()) {
    const refreshed = await refreshAccessToken(connection.refresh_token);
    accessToken = refreshed.accessToken;
    await supabase
      .from("strava_connection")
      .update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        expires_at: new Date(refreshed.expiresAt * 1000).toISOString(),
      })
      .eq("user_id", connection.user_id);
  }

  try {
    const stravaActivity = await fetchStravaActivity(event.object_id, accessToken);
    const normalized = normalizeStravaActivity(stravaActivity);

    // Best-effort enrichment: only worth asking for zones if the activity
    // has HR data at all, and a failure here must never block ingestion of
    // the activity itself.
    if (stravaActivity.average_heartrate != null) {
      try {
        const zones = await fetchStravaActivityZones(event.object_id, accessToken);
        normalized.hrZoneSeconds = hrZoneSecondsFromStravaZones(zones);
      } catch (err) {
        console.error("Strava zones fetch failed, continuing without zone data", err);
      }
    }

    const dedupKey = computeDedupKey(normalized);

    const { data: existingRow } = await supabase
      .from("activities")
      .select(
        "dedup_key, source, sport, sub_sport, start_time, duration_seconds, distance_meters, avg_pace_sec_per_km, avg_hr, max_hr, hr_zone_seconds, elevation_gain_meters, avg_cadence, calories",
      )
      .eq("user_id", connection.user_id)
      .eq("dedup_key", dedupKey)
      .maybeSingle();

    const existing = existingRow ? rowToActivityInput(existingRow as ExistingActivityRow) : null;
    const { merged, source } = mergeActivity(existing, normalized, "strava");

    const insertRow = activityInputToInsert({
      activity: merged,
      source,
      dedupKey,
      userId: connection.user_id,
      importBatchId: null,
      fileHash: null,
    });

    const { error } = await supabase.from("activities").upsert(insertRow, { onConflict: "user_id,dedup_key" });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Strava webhook processing failed", err);
  }

  return NextResponse.json({ ok: true });
}
