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
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-[32px] font-bold tracking-tight">Plan</h1>
        </header>
        <div className="rounded-2xl bg-card p-4 text-sm text-muted">
          Für einen Trainingsplan wird zuerst ein Renndatum benötigt.
        </div>
        <Link
          href="/settings"
          className="tap-shrink self-start rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-accent-foreground"
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
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-[32px] font-bold tracking-tight">Plan</h1>
        </header>
        <div className="rounded-2xl bg-card p-4 text-sm text-muted">
          Noch kein Trainingsplan erstellt. Renndatum: {settings.race_name ? `${settings.race_name}, ` : ""}
          {settings.race_date}
        </div>
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

  const { data: recentAdjustments } = await supabase
    .from("plan_adjustments")
    .select("id, triggered_at, rationale_text")
    .eq("plan_id", plan.id)
    .order("triggered_at", { ascending: false })
    .limit(3);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">Plan</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {settings.race_name ? `${settings.race_name} · ` : ""}
            {plan.race_date}
          </p>
        </div>
        <GeneratePlanButton hasPlan />
      </header>

      {recentAdjustments != null && recentAdjustments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Letzte Anpassung</h2>
          <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
            {recentAdjustments.map((adjustment) => (
              <p key={adjustment.id} className="text-[13px] leading-snug text-foreground">
                {adjustment.rationale_text}
              </p>
            ))}
          </div>
        </section>
      )}

      {currentWeek && (
        <section className="flex flex-col gap-2">
          <Link href={`/week/${currentWeek.id}`} className="flex items-baseline justify-between px-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Woche {currentWeek.week_number}
              {currentWeek.is_deload ? " · Deload" : ""}
            </span>
            <span className="text-xs text-muted">
              {currentWeek.target_volume_km} km
              {currentWeek.target_long_run_km != null ? ` · LR ${currentWeek.target_long_run_km} km` : ""}
            </span>
          </Link>
          <WeekWorkoutsList workouts={workouts ?? []} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Makrozyklus</h2>
        <PlanMacrocycle phases={phases ?? []} />
      </section>
    </div>
  );
}
