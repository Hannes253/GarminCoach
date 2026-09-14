import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types.generated";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type TodaysWorkout = Pick<
  Database["public"]["Tables"]["planned_workouts"]["Row"],
  "id" | "date" | "workout_type" | "target_distance_km" | "status"
>;

/**
 * Today's planned workout from the user's *active* plan only. A superseded
 * plan's plan_weeks/planned_workouts rows stay in the DB (only the plan's
 * status flips), so this walks the active plan -> phases -> week-containing-
 * today chain rather than querying planned_workouts by date alone, which
 * could otherwise match a stale plan's row for the same calendar day after
 * a regenerate.
 */
export async function loadTodaysWorkout(): Promise<TodaysWorkout | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!plan) return null;

  const { data: phases } = await supabase.from("plan_phases").select("id").eq("plan_id", plan.id);
  const phaseIds = (phases ?? []).map((p) => p.id);
  if (phaseIds.length === 0) return null;

  const { data: week } = await supabase
    .from("plan_weeks")
    .select("id")
    .in("phase_id", phaseIds)
    .gte("week_start_date", addDays(today, -6))
    .lte("week_start_date", today)
    .maybeSingle();
  if (!week) return null;

  const { data: workout } = await supabase
    .from("planned_workouts")
    .select("id, date, workout_type, target_distance_km, status")
    .eq("plan_week_id", week.id)
    .eq("date", today)
    .maybeSingle();

  return workout ?? null;
}

export interface DashboardExtras {
  raceName: string | null;
  daysToRace: number | null;
  currentWeekTargetVolumeKm: number | null;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00.000Z`).getTime();
  const to = new Date(`${toIso}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/** Race countdown and this week's target volume, for the Home dashboard's stat cards. */
export async function loadDashboardExtras(): Promise<DashboardExtras> {
  const empty: DashboardExtras = { raceName: null, daysToRace: null, currentWeekTargetVolumeKm: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const today = new Date().toISOString().slice(0, 10);

  const { data: settings } = await supabase
    .from("user_settings")
    .select("race_date, race_name")
    .eq("id", user.id)
    .maybeSingle();

  const daysToRace = settings?.race_date ? daysBetween(today, settings.race_date) : null;

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  let currentWeekTargetVolumeKm: number | null = null;
  if (plan) {
    const { data: phases } = await supabase.from("plan_phases").select("id").eq("plan_id", plan.id);
    const phaseIds = (phases ?? []).map((p) => p.id);
    if (phaseIds.length > 0) {
      const { data: week } = await supabase
        .from("plan_weeks")
        .select("target_volume_km")
        .in("phase_id", phaseIds)
        .gte("week_start_date", addDays(today, -6))
        .lte("week_start_date", today)
        .maybeSingle();
      currentWeekTargetVolumeKm = week?.target_volume_km ?? null;
    }
  }

  return { raceName: settings?.race_name ?? null, daysToRace, currentWeekTargetVolumeKm };
}
