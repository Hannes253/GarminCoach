import type { Activity, PlannedWorkout } from "../types";

export interface ReconcileResult {
  /** Only the workouts whose status/completedActivityId actually changed. */
  updatedWorkouts: PlannedWorkout[];
}

/**
 * Lazily syncs planned_workouts against real activities - called once per
 * app open, there is no cron/webhook trigger for this in v1:
 *  - a still-"planned" workout with an unlinked same-day run activity is
 *    auto-completed and linked to it (no manual "check off" needed for the
 *    common case of a watch/Strava-synced run)
 *  - a still-"planned" workout whose date has fully passed with no matching
 *    activity is marked "missed"
 * Rest days and already-decided workouts (completed/missed/skipped_replanned/
 * modified) are left alone.
 */
export function reconcileWorkouts(
  workouts: PlannedWorkout[],
  activities: Activity[],
  today: string,
): ReconcileResult {
  const alreadyLinkedActivityIds = new Set(
    workouts.map((w) => w.completedActivityId).filter((id): id is string => id != null),
  );

  const activitiesByDate = new Map<string, Activity[]>();
  for (const activity of activities) {
    if (activity.sport !== "run") continue;
    const date = activity.startTime.slice(0, 10);
    const list = activitiesByDate.get(date);
    if (list) list.push(activity);
    else activitiesByDate.set(date, [activity]);
  }

  const updatedWorkouts: PlannedWorkout[] = [];

  for (const workout of workouts) {
    if (workout.workoutType === "rest" || workout.status !== "planned") continue;

    const match = (activitiesByDate.get(workout.date) ?? []).find((a) => !alreadyLinkedActivityIds.has(a.id));

    if (match) {
      alreadyLinkedActivityIds.add(match.id);
      updatedWorkouts.push({ ...workout, status: "completed", completedActivityId: match.id });
      continue;
    }

    if (workout.date < today) {
      updatedWorkouts.push({ ...workout, status: "missed" });
    }
  }

  return { updatedWorkouts };
}
