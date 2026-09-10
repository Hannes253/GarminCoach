import type { TrainingScienceConfig } from "../config/training-science.config";
import type { Warning } from "../types";
import type { DailyLoadPoint } from "./load";
import { detectRampRateWarnings, type WeeklyVolumePoint } from "./volume";

/**
 * Acute:Chronic Workload Ratio using our EWMA ATL/CTL (an EWMA-ACWR, which
 * avoids the sudden-dropout artifacts of the classic rolling-average ACWR -
 * Murray et al.). Only checks the most recent day in the series; only a
 * "load is climbing too fast right now" signal, not a history of past
 * spikes.
 */
export function detectOverreachWarnings(loadSeries: DailyLoadPoint[], config: TrainingScienceConfig): Warning[] {
  const latest = loadSeries.at(-1);
  if (!latest || latest.ctl <= 0) return [];

  const acwr = latest.atl / latest.ctl;
  if (acwr <= config.adaptationThresholds.overreachAcwrThreshold) return [];

  return [
    {
      code: "overreach_acwr",
      severity: "critical",
      message:
        `Akut-zu-chronisch-Belastungsverhältnis liegt bei ${acwr.toFixed(2)} ` +
        `(Schwelle: ${config.adaptationThresholds.overreachAcwrThreshold}) - erhöhtes Verletzungs-/Übertrainingsrisiko.`,
      context: { date: latest.date, acwr, atl: latest.atl, ctl: latest.ctl },
    },
  ];
}

/** Combines all analysis-derived warnings the Home page shows. */
export function aggregateWarnings(
  weeklyVolume: WeeklyVolumePoint[],
  loadSeries: DailyLoadPoint[],
  config: TrainingScienceConfig,
): Warning[] {
  return [...detectRampRateWarnings(weeklyVolume, config), ...detectOverreachWarnings(loadSeries, config)];
}
