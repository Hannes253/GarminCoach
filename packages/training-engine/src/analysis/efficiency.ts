import type { TrainingScienceConfig } from "../config/training-science.config";
import type { Activity, HrZoneId } from "../types";
import { zoneKeyToBucket } from "./zoneBucket";

export interface EfficiencyPoint {
  date: string; // YYYY-MM-DD
  paceSecPerKm: number;
  avgHr: number;
  /** Speed (m/s) per heartbeat - a TrainingPeaks-style Efficiency Factor. Higher = more aerobically efficient at the same effort. */
  efficiencyFactor: number;
}

/**
 * Aerobic efficiency trend: pace at comparable (easy) heart rate over time,
 * so a rising efficiencyFactor reflects real aerobic fitness gains rather
 * than just "ran faster because it was a harder effort." Only runs whose HR
 * time was mostly (>= minEasyFraction) in the configured "easy" zone bucket
 * are included, and only runs with a HR-zone breakdown at all - CSV/Strava
 * imports without one are silently excluded rather than guessed at.
 */
export function computeAerobicEfficiencyTrend(
  activities: Activity[],
  config: TrainingScienceConfig,
  minEasyFraction = 0.7,
): EfficiencyPoint[] {
  const easySet = new Set<HrZoneId>(config.intensityDistribution.zoneBuckets.easy);
  const points: EfficiencyPoint[] = [];

  for (const activity of activities) {
    if (activity.sport !== "run") continue;
    if (!activity.avgHr || !activity.avgPaceSecPerKm || !activity.hrZoneSeconds) continue;

    let easySeconds = 0;
    let totalSeconds = 0;
    for (const [key, seconds] of Object.entries(activity.hrZoneSeconds)) {
      const bucket = zoneKeyToBucket(key);
      if (!bucket || seconds == null) continue;
      totalSeconds += seconds;
      if (easySet.has(bucket)) easySeconds += seconds;
    }
    if (totalSeconds === 0 || easySeconds / totalSeconds < minEasyFraction) continue;

    const speedMetersPerSecond = 1000 / activity.avgPaceSecPerKm;
    points.push({
      date: activity.startTime.slice(0, 10),
      paceSecPerKm: activity.avgPaceSecPerKm,
      avgHr: activity.avgHr,
      efficiencyFactor: speedMetersPerSecond / activity.avgHr,
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}
