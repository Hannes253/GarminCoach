import { NextResponse } from "next/server";
import { buildWorkoutFitFile } from "@/lib/export/workoutFit";
import { loadTodaysWorkout } from "@/lib/data/plan";

/**
 * Downloads today's planned workout as a single-step FIT workout file, for
 * manual import into Garmin Connect. Generated fresh per request (not
 * cached) so it always reflects the latest plan - proxy.ts's auth guard
 * already covers this route, the getUser() check inside loadTodaysWorkout
 * just keeps the route self-contained.
 */
export async function GET() {
  const workout = await loadTodaysWorkout();

  if (!workout || workout.workout_type === "rest" || workout.target_distance_km == null) {
    return NextResponse.json({ error: "Für heute steht keine exportierbare Einheit im Plan." }, { status: 404 });
  }

  const bytes = buildWorkoutFitFile({
    workoutType: workout.workout_type,
    targetDistanceKm: workout.target_distance_km,
  });

  return new NextResponse(new Blob([bytes.slice()]), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${workout.date}-workout.fit"`,
    },
  });
}
