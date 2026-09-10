import type { TrainingScienceConfig } from "../config/training-science.config";
import type { Activity } from "../types";
import { zoneKeyToBucket } from "./zoneBucket";

/**
 * Single-activity load score (see loadModel in the training-science
 * config). Strength sessions use session-RPE x duration (0 if RPE was
 * never logged - there is no other signal to estimate load from). Endurance
 * sessions use the zone-weighted minutes when a HR-zone breakdown exists,
 * falling back to a neutral duration-only estimate when it doesn't (CSV and
 * Strava imports don't carry a zone breakdown).
 */
export function computeActivityLoad(activity: Activity, config: TrainingScienceConfig): number {
  const durationMinutes = activity.durationSeconds / 60;

  if (activity.sport === "strength") {
    if (activity.rpe == null) return 0;
    return activity.rpe * durationMinutes;
  }

  if (activity.hrZoneSeconds) {
    let weightedMinutes = 0;
    let sawKnownZone = false;
    for (const [key, seconds] of Object.entries(activity.hrZoneSeconds)) {
      const bucket = zoneKeyToBucket(key);
      if (!bucket || seconds == null) continue;
      sawKnownZone = true;
      weightedMinutes += (seconds / 60) * config.loadModel.zoneLoadWeights[bucket];
    }
    if (sawKnownZone) return weightedMinutes;
  }

  return durationMinutes * config.loadModel.noZoneDataFallbackFactor;
}

export interface DailyLoadPoint {
  date: string; // YYYY-MM-DD
  load: number;
  atl: number;
  ctl: number;
  tsb: number;
}

/**
 * Daily ATL/CTL/TSB series from `lookbackDays` before `today` through
 * `today`, using the classic Banister/Coggan exponentially-weighted moving
 * average (time constants from config.loadModel). ATL and CTL start at 0 at
 * the beginning of the lookback window, so a series that starts mid-history
 * will show an artificial ramp for the first ~2x the CTL window - widen
 * `lookbackDays` if more history is available to reduce that effect.
 */
export function computeRollingLoad(
  activities: Activity[],
  today: string,
  config: TrainingScienceConfig,
  lookbackDays = 120,
): DailyLoadPoint[] {
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const startDate = new Date(todayDate);
  startDate.setUTCDate(startDate.getUTCDate() - lookbackDays);

  const loadByDate = new Map<string, number>();
  for (const activity of activities) {
    const date = activity.startTime.slice(0, 10);
    const load = computeActivityLoad(activity, config);
    loadByDate.set(date, (loadByDate.get(date) ?? 0) + load);
  }

  const points: DailyLoadPoint[] = [];
  let atl = 0;
  let ctl = 0;
  const cursor = new Date(startDate);

  while (cursor.getTime() <= todayDate.getTime()) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const load = loadByDate.get(dateStr) ?? 0;

    atl += (load - atl) / config.loadModel.atlWindowDays;
    ctl += (load - ctl) / config.loadModel.ctlWindowDays;

    points.push({ date: dateStr, load, atl, ctl, tsb: ctl - atl });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

export type FormStatus = "fresh" | "neutral" | "fatigued" | "very_fatigued";

/** Buckets a TSB value into a form-status label, per config.formStatus. */
export function classifyForm(tsb: number, config: TrainingScienceConfig): FormStatus {
  if (tsb >= config.formStatus.freshMin) return "fresh";
  if (tsb > config.formStatus.fatiguedMax) return "neutral";
  if (tsb > config.formStatus.veryFatiguedMax) return "fatigued";
  return "very_fatigued";
}
