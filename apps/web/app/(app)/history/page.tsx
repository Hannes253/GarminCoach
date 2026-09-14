import type { ReactNode } from "react";
import {
  aggregateWarnings,
  classifyForm,
  computeAerobicEfficiencyTrend,
  computeIntensityDistribution,
  computeRollingLoad,
  computeWeeklyVolume,
  defaultTrainingScienceConfig,
  trackLongRunProgression,
} from "@garmincoach/training-engine";
import { BarChart } from "@/components/charts/BarChart";
import { FitnessTrendChart } from "@/components/charts/FitnessTrendChart";
import { IntensityBar } from "@/components/charts/IntensityBar";
import { FormStatusBadge } from "@/components/FormStatusBadge";
import { WarningsList } from "@/components/WarningsList";
import { loadEngineActivities } from "@/lib/data/activities";
import { loadDashboardExtras } from "@/lib/data/plan";

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[var(--radius-card)] bg-card p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default async function HistoryPage() {
  const activities = await loadEngineActivities();
  const today = new Date().toISOString().slice(0, 10);
  const config = defaultTrainingScienceConfig;

  const weeklyVolume = computeWeeklyVolume(activities);
  const recentWeeks = weeklyVolume.slice(-8);

  const loadSeries = computeRollingLoad(activities, today, config);
  const latestLoad = loadSeries.at(-1);
  const formStatus = latestLoad ? classifyForm(latestLoad.tsb, config) : null;
  const trendPoints = loadSeries.slice(-56).map((p) => ({ date: p.date, ctl: p.ctl, atl: p.atl }));

  const intensity = computeIntensityDistribution(activities, config);
  const efficiency = computeAerobicEfficiencyTrend(activities, config);
  const longRunWeeks = trackLongRunProgression(weeklyVolume).slice(-8);

  const warnings = aggregateWarnings(weeklyVolume, loadSeries, config);
  const extras = await loadDashboardExtras();

  if (activities.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-[32px] font-bold tracking-tight">Verlauf</h1>
        </header>
        <div className="rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted">
          Noch keine Aktivitäten vorhanden. Importier zuerst Daten auf der Import-Seite.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight">Verlauf</h1>
      </header>

      <WarningsList warnings={warnings} />

      <Card title="Formstand">
        {latestLoad && formStatus ? (
          <>
            <FormStatusBadge status={formStatus} />
            <p className="text-xs text-muted">
              TSB {latestLoad.tsb.toFixed(0)} · Akute Last (7T) {latestLoad.atl.toFixed(0)} · Chronische Last
              ({config.loadModel.ctlWindowDays}T) {latestLoad.ctl.toFixed(0)}
            </p>
            {trendPoints.length >= 2 && (
              <div className="mt-1">
                <FitnessTrendChart points={trendPoints} />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Noch keine Daten für den Formstand.</p>
        )}
      </Card>

      <Card title="Wochenvolumen (Laufen)">
        <BarChart
          points={recentWeeks.map((w) => ({ key: w.weekStart, label: formatShortDate(w.weekStart), value: w.distanceKm }))}
          valueSuffix=" km"
          targetValue={extras.currentWeekTargetVolumeKm ?? undefined}
          targetLabel={extras.currentWeekTargetVolumeKm != null ? "Ziel" : undefined}
        />
      </Card>

      <Card title="Intensitätsverteilung">
        {intensity ? (
          <>
            <IntensityBar
              segments={[
                { key: "easy", label: "Locker", pct: intensity.easyPct },
                { key: "moderate", label: "Mittel", pct: intensity.moderatePct },
                { key: "hard", label: "Hart", pct: intensity.hardPct },
              ]}
            />
            <p className="text-xs text-muted">
              Ziel: {intensity.targetEasyPct}% locker (80/20-Prinzip) ·{" "}
              {intensity.deviationPct >= 0
                ? `${intensity.deviationPct.toFixed(0)} Punkte über Ziel`
                : `${Math.abs(intensity.deviationPct).toFixed(0)} Punkte unter Ziel`}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Noch keine Läufe mit Herzfrequenz-Zonen-Daten (nur per FIT-Import verfügbar).
          </p>
        )}
      </Card>

      <Card title="Aerobe Effizienz">
        {efficiency.length >= 2 ? (
          <div className="flex flex-col gap-1 text-sm">
            <p>
              Letzter lockerer Lauf: {formatPace(efficiency.at(-1)!.paceSecPerKm)} bei {efficiency.at(-1)!.avgHr}{" "}
              bpm
            </p>
            <p className="text-xs text-muted">
              {efficiency.at(-1)!.efficiencyFactor > efficiency[0]!.efficiencyFactor
                ? "Effizienz verbessert sich seit Beginn der Aufzeichnung."
                : "Effizienz noch ohne klaren Trend seit Beginn der Aufzeichnung."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">Noch zu wenige lockere Läufe mit HF-Daten für einen Effizienz-Trend.</p>
        )}
      </Card>

      <Card title="Long-Run-Entwicklung">
        <BarChart
          points={longRunWeeks.map((w) => ({ key: w.weekStart, label: formatShortDate(w.weekStart), value: w.longRunKm }))}
          valueSuffix=" km"
          formatValue={(v) => v.toFixed(1)}
        />
      </Card>
    </div>
  );
}
