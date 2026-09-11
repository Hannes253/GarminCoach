import type { Database } from "@/lib/supabase/types.generated";

type WorkoutRow = Pick<
  Database["public"]["Tables"]["planned_workouts"]["Row"],
  "id" | "date" | "workout_type" | "target_distance_km" | "status"
>;

const WORKOUT_LABELS: Record<WorkoutRow["workout_type"], string> = {
  easy: "Locker",
  long_run: "Langer Lauf",
  tempo: "Tempolauf",
  intervals: "Intervalle",
  recovery: "Regeneration",
  rest: "Ruhetag",
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function weekdayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const isoDay = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
  return WEEKDAY_LABELS[isoDay]!;
}

export function WeekWorkoutsList({ workouts }: { workouts: WorkoutRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      {workouts.map((w) => (
        <div
          key={w.id}
          className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
            w.workout_type === "rest"
              ? "border-black/5 text-foreground/40 dark:border-white/5"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          <span className="w-6 shrink-0 text-xs text-foreground/60">{weekdayLabel(w.date)}</span>
          <span className="flex-1">{WORKOUT_LABELS[w.workout_type]}</span>
          {w.target_distance_km != null && (
            <span className="text-xs text-foreground/60">{w.target_distance_km} km</span>
          )}
        </div>
      ))}
    </div>
  );
}
