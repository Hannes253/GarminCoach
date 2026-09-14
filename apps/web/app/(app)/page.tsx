import {
  aggregateWarnings,
  classifyForm,
  computeRollingLoad,
  computeWeeklyVolume,
  defaultTrainingScienceConfig,
  type FormStatus,
} from "@garmincoach/training-engine";
import { DailyLogWidget } from "@/components/DailyLogWidget";
import { TodaysWorkoutCard } from "@/components/TodaysWorkoutCard";
import { WarningsList } from "@/components/WarningsList";
import { FitnessTrendChart } from "@/components/charts/FitnessTrendChart";
import { StatCard, StatCardGrid, type StatCardTone } from "@/components/charts/StatCard";
import { runLazyAdaptation } from "@/lib/adaptation/runLazyAdaptation";
import { loadEngineActivities } from "@/lib/data/activities";
import { loadDashboardExtras, loadTodaysWorkout } from "@/lib/data/plan";

const FORM_TONE: Record<FormStatus, StatCardTone> = {
  fresh: "success",
  neutral: "neutral",
  fatigued: "warning",
  very_fatigued: "danger",
};

const FORM_LABEL: Record<FormStatus, string> = {
  fresh: "Frisch",
  neutral: "Ausgeglichen",
  fatigued: "Ermüdet",
  very_fatigued: "Stark ermüdet",
};

/** Monday of the ISO week containing dateIso (UTC), e.g. matching computeWeeklyVolume's own bucketing. */
function weekStartOf(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

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
  const extras = await loadDashboardExtras();

  const currentWeekVolumeKm = weeklyVolume.find((w) => w.weekStart === weekStartOf(today))?.distanceKm ?? 0;
  const trendPoints = loadSeries.slice(-56).map((p) => ({ date: p.date, ctl: p.ctl, atl: p.atl }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight">Heute</h1>
      </header>

      {activities.length > 0 && (
        <StatCardGrid>
          <StatCard
            label="Formstand"
            value={formStatus ? FORM_LABEL[formStatus] : "–"}
            tone={formStatus ? FORM_TONE[formStatus] : "neutral"}
            sub={latestLoad ? `TSB ${latestLoad.tsb.toFixed(0)}` : undefined}
          />
          <StatCard
            label="Fitness (CTL)"
            value={latestLoad ? latestLoad.ctl.toFixed(0) : "–"}
            sub={latestLoad ? `ATL ${latestLoad.atl.toFixed(0)}` : undefined}
          />
          <StatCard
            label="Wochenvolumen"
            value={currentWeekVolumeKm.toFixed(0)}
            unit="km"
            sub={extras.currentWeekTargetVolumeKm != null ? `Ziel ${extras.currentWeekTargetVolumeKm.toFixed(0)} km` : undefined}
          />
          <StatCard
            label="Bis zum Rennen"
            value={extras.daysToRace != null ? String(Math.max(0, extras.daysToRace)) : "–"}
            unit={extras.daysToRace != null ? "Tage" : undefined}
            sub={extras.raceName ?? undefined}
          />
        </StatCardGrid>
      )}

      <TodaysWorkoutCard workout={todaysWorkout} />

      <DailyLogWidget />

      {activities.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted">
          Noch keine Aktivitäten importiert. Geh auf die Import-Seite, um loszulegen.
        </div>
      ) : (
        <>
          {trendPoints.length >= 2 && (
            <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-card p-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Fitness-Verlauf</h2>
              <FitnessTrendChart points={trendPoints} />
            </section>
          )}

          <WarningsList warnings={warnings} />
        </>
      )}
    </div>
  );
}
