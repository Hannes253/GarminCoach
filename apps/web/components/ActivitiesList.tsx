import { ActivityRow, type ActivityRowData } from "@/components/ActivityRow";
import { createClient } from "@/lib/supabase/server";

export async function ActivitiesList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: activities }, { data: manualFields }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, sport, start_time, distance_meters, duration_seconds, avg_pace_sec_per_km, avg_hr")
      .eq("user_id", user.id)
      .order("start_time", { ascending: false })
      .limit(50),
    supabase.from("activity_manual_fields").select("activity_id, rpe, note").eq("user_id", user.id),
  ]);

  if (!activities || activities.length === 0) {
    return <p className="rounded-2xl bg-card p-4 text-sm text-muted">Noch keine Aktivitäten importiert.</p>;
  }

  const manualByActivityId = new Map((manualFields ?? []).map((m) => [m.activity_id, m]));

  const rows: ActivityRowData[] = activities.map((activity) => {
    const manual = manualByActivityId.get(activity.id);
    return {
      id: activity.id,
      sport: activity.sport,
      startTime: activity.start_time,
      distanceMeters: activity.distance_meters,
      durationSeconds: activity.duration_seconds,
      avgPaceSecPerKm: activity.avg_pace_sec_per_km,
      avgHr: activity.avg_hr,
      rpe: manual?.rpe ?? null,
      note: manual?.note ?? null,
    };
  });

  return (
    <div className="divide-y divide-separator overflow-hidden rounded-2xl bg-card">
      {rows.map((activity) => (
        <ActivityRow key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
