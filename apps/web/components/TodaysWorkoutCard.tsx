import type { TodaysWorkout } from "@/lib/data/plan";

const WORKOUT_LABELS: Record<TodaysWorkout["workout_type"], string> = {
  easy: "Locker",
  long_run: "Langer Lauf",
  tempo: "Tempolauf",
  intervals: "Intervalle",
  recovery: "Regeneration",
  rest: "Ruhetag",
};

export function TodaysWorkoutCard({ workout }: { workout: TodaysWorkout | null }) {
  if (!workout) return null;

  const isRest = workout.workout_type === "rest";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Heutige Einheit</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{WORKOUT_LABELS[workout.workout_type]}</p>
        {!isRest && workout.target_distance_km != null && (
          <p className="text-sm text-muted">{workout.target_distance_km} km</p>
        )}
      </div>
      {!isRest && workout.target_distance_km != null && (
        <a
          href="/api/export/workout/today"
          className="tap-shrink shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-foreground"
        >
          Für Uhr exportieren
        </a>
      )}
    </div>
  );
}
