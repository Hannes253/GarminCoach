import { createClient } from "@/lib/supabase/server";

export async function StravaConnectStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: connection } = await supabase
    .from("strava_connection")
    .select("athlete_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connection) {
    return (
      <p className="text-sm text-foreground/70">
        Mit Strava verbunden (Athlete #{connection.athlete_id}) — neue Aktivitäten werden automatisch importiert.
      </p>
    );
  }

  return (
    <a
      href="/api/strava/connect"
      className="inline-block rounded-md bg-[#FC4C02] px-3 py-2 text-sm font-medium text-white"
    >
      Mit Strava verbinden
    </a>
  );
}
