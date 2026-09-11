"use client";

import { useState, useTransition } from "react";
import { markWorkoutCompleted } from "@/lib/actions/plan";
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

const STATUS_LABELS: Record<WorkoutRow["status"], { label: string; className: string }> = {
  planned: { label: "Geplant", className: "text-muted" },
  completed: { label: "Erledigt", className: "text-success" },
  missed: { label: "Verpasst", className: "text-danger" },
  skipped_replanned: { label: "Verschoben", className: "text-warning" },
  modified: { label: "Angepasst", className: "text-warning" },
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function weekdayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const isoDay = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
  return WEEKDAY_LABELS[isoDay]!;
}

export function WorkoutStatusRow({ workout }: { workout: WorkoutRow }) {
  const [status, setStatus] = useState(workout.status);
  const [isPending, startTransition] = useTransition();
  const isRest = workout.workout_type === "rest";
  const statusInfo = STATUS_LABELS[status];

  function handleMarkDone() {
    startTransition(async () => {
      await markWorkoutCompleted(workout.id);
      setStatus("completed");
    });
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isRest ? "opacity-50" : ""}`}>
      <span className="w-6 shrink-0 text-xs text-muted">{weekdayLabel(workout.date)}</span>
      <div className="flex-1">
        <p className="text-[15px]">{WORKOUT_LABELS[workout.workout_type]}</p>
        <p className={`text-xs ${statusInfo.className}`}>{statusInfo.label}</p>
      </div>
      {workout.target_distance_km != null && <span className="text-[13px] text-muted">{workout.target_distance_km} km</span>}
      {!isRest && status === "planned" && (
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isPending}
          className="tap-shrink shrink-0 rounded-full bg-fill px-3 py-1.5 text-[12px] font-medium text-accent disabled:opacity-50"
        >
          {isPending ? "…" : "Erledigt"}
        </button>
      )}
    </div>
  );
}
