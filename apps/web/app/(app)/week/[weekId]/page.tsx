import { notFound } from "next/navigation";
import { WorkoutStatusRow } from "@/components/WorkoutStatusRow";
import { createClient } from "@/lib/supabase/server";

const PHASE_LABELS: Record<string, string> = {
  base: "Grundlage",
  build: "Aufbau",
  specific: "Spezifisch",
  taper: "Taper",
};

export default async function WeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: week } = await supabase
    .from("plan_weeks")
    .select("id, phase_id, week_start_date, week_number, is_deload, target_volume_km, target_long_run_km")
    .eq("id", weekId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!week) notFound();

  const { data: phase } = await supabase
    .from("plan_phases")
    .select("phase_type")
    .eq("id", week.phase_id)
    .maybeSingle();

  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("id, date, workout_type, target_distance_km, status")
    .eq("plan_week_id", week.id)
    .order("sequence_in_week", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight">Woche {week.week_number}</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {phase ? PHASE_LABELS[phase.phase_type] : ""} · ab {week.week_start_date}
          {week.is_deload ? " · Deload" : ""}
        </p>
      </header>

      <p className="text-xs text-muted">
        Ziel: {week.target_volume_km} km
        {week.target_long_run_km != null ? ` (davon Long Run ${week.target_long_run_km} km)` : ""}
      </p>

      <div className="divide-y divide-separator overflow-hidden rounded-[var(--radius-card)] bg-card">
        {(workouts ?? []).map((workout) => (
          <WorkoutStatusRow key={workout.id} workout={workout} />
        ))}
      </div>
    </div>
  );
}
