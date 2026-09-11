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

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export function WeekWorkoutsList({ workouts }: { workouts: WorkoutRow[] }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-card">
      {workouts.map((w, i) => {
        const isRest = w.workout_type === "rest";
        return (
          <div
            key={w.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              i < workouts.length - 1 ? "border-b border-separator" : ""
            } ${isRest ? "opacity-50" : ""}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                isToday(w.date) ? "bg-accent text-accent-foreground" : "bg-fill text-muted"
              }`}
            >
              {weekdayLabel(w.date)}
            </span>
            <span className="flex-1 text-[15px]">{WORKOUT_LABELS[w.workout_type]}</span>
            {w.target_distance_km != null && (
              <span className="text-[13px] text-muted">{w.target_distance_km} km</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
