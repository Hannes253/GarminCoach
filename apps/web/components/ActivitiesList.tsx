import { createClient } from "@/lib/supabase/server";

const SPORT_LABELS: Record<string, string> = {
  run: "Laufen",
  bike: "Rad",
  strength: "Kraft",
  other: "Sonstiges",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(secPerKm: number | null): string | null {
  if (!secPerKm) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function ActivitiesList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: activities } = await supabase
    .from("activities")
    .select("id, sport, start_time, distance_meters, duration_seconds, avg_pace_sec_per_km, avg_hr")
    .eq("user_id", user.id)
    .order("start_time", { ascending: false })
    .limit(50);

  if (!activities || activities.length === 0) {
    return <p className="text-sm text-foreground/60">Noch keine Aktivitäten importiert.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
      {activities.map((activity) => {
        const pace = formatPace(activity.avg_pace_sec_per_km);
        return (
          <div key={activity.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-medium">{SPORT_LABELS[activity.sport] ?? activity.sport}</div>
              <div className="text-xs text-foreground/50">{formatDate(activity.start_time)}</div>
            </div>
            <div className="text-right text-xs text-foreground/70">
              {activity.distance_meters != null && <div>{(activity.distance_meters / 1000).toFixed(2)} km</div>}
              <div>{formatDuration(activity.duration_seconds)}</div>
              {pace && <div>{pace}</div>}
              {activity.avg_hr != null && <div>{activity.avg_hr} bpm</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
