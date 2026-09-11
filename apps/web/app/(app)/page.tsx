import {
  aggregateWarnings,
  classifyForm,
  computeRollingLoad,
  computeWeeklyVolume,
  defaultTrainingScienceConfig,
} from "@garmincoach/training-engine";
import { DailyLogWidget } from "@/components/DailyLogWidget";
import { FormStatusBadge } from "@/components/FormStatusBadge";
import { TodaysWorkoutCard } from "@/components/TodaysWorkoutCard";
import { WarningsList } from "@/components/WarningsList";
import { runLazyAdaptation } from "@/lib/adaptation/runLazyAdaptation";
import { loadEngineActivities } from "@/lib/data/activities";
import { loadTodaysWorkout } from "@/lib/data/plan";

export default async function HomePage() {
  const activities = await loadEngineActivities();
  // Lazy recompute: reconciles planned_workouts against real activities and
  // lets the adaptation engine react to missed sessions/weeks/overtraining
  // before today's workout is read below - no cron/scheduling in v1, this
  // is the only trigger.
  await runLazyAdaptation(activities);
  const todaysWorkout = await loadTodaysWorkout();
  const today = new Date().toISOString().slice(0, 10);
  const config = defaultTrainingScienceConfig;

  const weeklyVolume = computeWeeklyVolume(activities);
  const loadSeries = computeRollingLoad(activities, today, config);
  const latestLoad = loadSeries.at(-1);
  const formStatus = latestLoad ? classifyForm(latestLoad.tsb, config) : null;
  const warnings = aggregateWarnings(weeklyVolume, loadSeries, config);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight">Heute</h1>
      </header>

      <DailyLogWidget />

      <TodaysWorkoutCard workout={todaysWorkout} />

      {activities.length === 0 ? (
        <div className="rounded-2xl bg-card p-4 text-sm text-muted">
          Noch keine Aktivitäten importiert. Geh auf die Import-Seite, um loszulegen.
        </div>
      ) : (
        <>
          {latestLoad && formStatus && (
            <div className="rounded-2xl bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Formstand</p>
              <FormStatusBadge status={formStatus} />
            </div>
          )}

          <WarningsList warnings={warnings} />
        </>
      )}
    </div>
  );
}
