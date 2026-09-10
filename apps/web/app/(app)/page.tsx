import {
  aggregateWarnings,
  classifyForm,
  computeRollingLoad,
  computeWeeklyVolume,
  defaultTrainingScienceConfig,
} from "@garmincoach/training-engine";
import { DailyLogWidget } from "@/components/DailyLogWidget";
import { FormStatusBadge } from "@/components/FormStatusBadge";
import { SignOutButton } from "@/components/SignOutButton";
import { WarningsList } from "@/components/WarningsList";
import { loadEngineActivities } from "@/lib/data/activities";

export default async function HomePage() {
  const activities = await loadEngineActivities();
  const today = new Date().toISOString().slice(0, 10);
  const config = defaultTrainingScienceConfig;

  const weeklyVolume = computeWeeklyVolume(activities);
  const loadSeries = computeRollingLoad(activities, today, config);
  const latestLoad = loadSeries.at(-1);
  const formStatus = latestLoad ? classifyForm(latestLoad.tsb, config) : null;
  const warnings = aggregateWarnings(weeklyVolume, loadSeries, config);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Heute</h1>
        <SignOutButton />
      </header>

      <DailyLogWidget />

      {activities.length === 0 ? (
        <p className="text-sm text-foreground/60">
          Noch keine Aktivitäten importiert. Geh auf die Import-Seite, um loszulegen.
        </p>
      ) : (
        <>
          {latestLoad && formStatus && (
            <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <p className="text-xs text-foreground/50">Formstand</p>
              <FormStatusBadge status={formStatus} />
            </div>
          )}

          <WarningsList warnings={warnings} />

          <p className="text-sm text-foreground/60">
            Die heutige Einheit steht hier, sobald Phase 3 (Planung) fertig ist.
          </p>
        </>
      )}
    </div>
  );
}
