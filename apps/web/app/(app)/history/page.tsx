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
import { FormStatusBadge } from "@/components/FormStatusBadge";
import { WarningsList } from "@/components/WarningsList";
import { loadEngineActivities } from "@/lib/data/activities";

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function Bar({ widthPct, valueLabel }: { widthPct: number; valueLabel: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, widthPct))}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">{valueLabel}</span>
    </div>
  );
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
  const maxWeeklyKm = Math.max(1, ...recentWeeks.map((w) => w.distanceKm));

  const loadSeries = computeRollingLoad(activities, today, config);
  const latestLoad = loadSeries.at(-1);
  const formStatus = latestLoad ? classifyForm(latestLoad.tsb, config) : null;

  const intensity = computeIntensityDistribution(activities, config);
  const efficiency = computeAerobicEfficiencyTrend(activities, config);
  const longRunWeeks = trackLongRunProgression(weeklyVolume).slice(-8);
  const maxLongRunKm = Math.max(1, ...longRunWeeks.map((w) => w.longRunKm));

  const warnings = aggregateWarnings(weeklyVolume, loadSeries, config);

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
          </>
        ) : (
          <p className="text-sm text-muted">Noch keine Daten für den Formstand.</p>
        )}
      </Card>

      <Card title="Wochenvolumen (Laufen)">
        <div className="flex flex-col gap-2">
          {recentWeeks.map((w) => (
            <Bar
              key={w.weekStart}
              widthPct={(w.distanceKm / maxWeeklyKm) * 100}
              valueLabel={`${w.distanceKm.toFixed(0)} km`}
            />
          ))}
        </div>
      </Card>

      <Card title="Intensitätsverteilung">
        {intensity ? (
          <>
            <div className="flex flex-col gap-2">
              <Bar widthPct={intensity.easyPct} valueLabel={`${intensity.easyPct.toFixed(0)}% locker`} />
              <Bar widthPct={intensity.moderatePct} valueLabel={`${intensity.moderatePct.toFixed(0)}% mittel`} />
              <Bar widthPct={intensity.hardPct} valueLabel={`${intensity.hardPct.toFixed(0)}% hart`} />
            </div>
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
        <div className="flex flex-col gap-2">
          {longRunWeeks.map((w) => (
            <Bar
              key={w.weekStart}
              widthPct={(w.longRunKm / maxLongRunKm) * 100}
              valueLabel={`${w.longRunKm.toFixed(1)} km`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
