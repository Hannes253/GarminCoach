import Link from "next/link";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { PlanMacrocycle } from "@/components/PlanMacrocycle";
import { WeekWorkoutsList } from "@/components/WeekWorkoutsList";
import { createClient } from "@/lib/supabase/server";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The week containing today, else the next upcoming week, else the last week (race has passed). */
function findCurrentOrNextWeek<T extends { week_start_date: string }>(weeks: T[], today: string): T | null {
  if (weeks.length === 0) return null;
  const current = weeks.find((w) => w.week_start_date <= today && today <= addDays(w.week_start_date, 6));
  if (current) return current;
  const upcoming = weeks.find((w) => w.week_start_date > today);
  if (upcoming) return upcoming;
  return weeks[weeks.length - 1]!;
}

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("race_date, race_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!settings?.race_date) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Plan</h1>
        <p className="text-sm text-foreground/60">
          Für einen Trainingsplan wird zuerst ein Renndatum benötigt.
        </p>
        <Link
          href="/settings"
          className="self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          Zu den Einstellungen
        </Link>
      </div>
    );
  }

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, race_date")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Plan</h1>
        <p className="text-sm text-foreground/60">
          Noch kein Trainingsplan erstellt. Renndatum: {settings.race_name ? `${settings.race_name}, ` : ""}
          {settings.race_date}
        </p>
        <GeneratePlanButton hasPlan={false} />
      </div>
    );
  }

  const { data: phases } = await supabase
    .from("plan_phases")
    .select("id, phase_type, start_date, end_date, target_weekly_volume_km, sequence_order")
    .eq("plan_id", plan.id)
    .order("sequence_order", { ascending: true });

  const phaseIds = (phases ?? []).map((p) => p.id);
  const { data: weeks } = phaseIds.length
    ? await supabase
        .from("plan_weeks")
        .select("id, phase_id, week_start_date, week_number, is_deload, target_volume_km, target_long_run_km")
        .in("phase_id", phaseIds)
        .order("week_start_date", { ascending: true })
    : { data: [] };

  const today = new Date().toISOString().slice(0, 10);
  const currentWeek = findCurrentOrNextWeek(weeks ?? [], today);

  const { data: workouts } = currentWeek
    ? await supabase
        .from("planned_workouts")
        .select("id, date, workout_type, target_distance_km, status")
        .eq("plan_week_id", currentWeek.id)
        .order("sequence_in_week", { ascending: true })
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Plan</h1>
        <GeneratePlanButton hasPlan />
      </header>

      <p className="text-sm text-foreground/60">
        Renntag: {settings.race_name ? `${settings.race_name}, ` : ""}
        {plan.race_date}
      </p>

      {currentWeek && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">
            Woche {currentWeek.week_number}
            {currentWeek.is_deload ? " · Deload" : ""} · ab {currentWeek.week_start_date}
          </h2>
          <p className="text-xs text-foreground/60">
            Ziel: {currentWeek.target_volume_km} km
            {currentWeek.target_long_run_km != null ? ` (davon Long Run ${currentWeek.target_long_run_km} km)` : ""}
          </p>
          <WeekWorkoutsList workouts={workouts ?? []} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Makrozyklus</h2>
        <PlanMacrocycle phases={phases ?? []} />
      </section>
    </div>
  );
}
