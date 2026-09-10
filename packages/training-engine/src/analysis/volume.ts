import type { TrainingScienceConfig } from "../config/training-science.config";
import type { Activity, Warning } from "../types";

export interface WeeklyVolumePoint {
  weekStart: string; // YYYY-MM-DD, Monday
  distanceKm: number;
  longRunKm: number;
  sessionCount: number;
}

/** Monday of the ISO week containing the given date, as YYYY-MM-DD (UTC). */
function weekStartOf(dateIso: string): string {
  const d = new Date(dateIso);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}

/**
 * Weekly running volume only - bike/strength are cross-training load, not
 * part of the run-volume ramp the 10% rule and marathon build are about
 * (see strengthTraining.isProgrammed in config). Weeks with no runs are
 * omitted rather than zero-filled; callers needing a continuous week axis
 * should zero-fill themselves against their own date range.
 */
export function computeWeeklyVolume(activities: Activity[]): WeeklyVolumePoint[] {
  const byWeek = new Map<string, WeeklyVolumePoint>();

  for (const activity of activities) {
    if (activity.sport !== "run" || !activity.distanceMeters) continue;

    const weekStart = weekStartOf(activity.startTime);
    const km = activity.distanceMeters / 1000;
    const point = byWeek.get(weekStart) ?? { weekStart, distanceKm: 0, longRunKm: 0, sessionCount: 0 };

    point.distanceKm += km;
    point.longRunKm = Math.max(point.longRunKm, km);
    point.sessionCount += 1;
    byWeek.set(weekStart, point);
  }

  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Flags any week-over-week increase beyond config.rampRate (the "10% rule").
 * Only compares consecutive weeks that both have volume - a week with zero
 * runs isn't itself a ramp-rate violation (that's the missed-training path,
 * handled by the adaptation engine in Phase 4).
 */
export function detectRampRateWarnings(
  weeklyVolume: WeeklyVolumePoint[],
  config: TrainingScienceConfig,
): Warning[] {
  const warnings: Warning[] = [];

  for (let i = 1; i < weeklyVolume.length; i++) {
    const prev = weeklyVolume[i - 1]!;
    const curr = weeklyVolume[i]!;
    if (prev.distanceKm <= 0) continue;

    const increasePct = ((curr.distanceKm - prev.distanceKm) / prev.distanceKm) * 100;
    if (increasePct > config.rampRate.maxWeeklyVolumeIncreasePct) {
      warnings.push({
        code: "ramp_rate_exceeded",
        severity: "warning",
        message:
          `Wochenvolumen um ${increasePct.toFixed(0)} % gesteigert (Woche ab ${curr.weekStart}) - ` +
          `mehr als die empfohlenen ${config.rampRate.maxWeeklyVolumeIncreasePct} %.`,
        context: {
          weekStart: curr.weekStart,
          previousKm: prev.distanceKm,
          currentKm: curr.distanceKm,
          increasePct,
        },
      });
    }
  }

  return warnings;
}
