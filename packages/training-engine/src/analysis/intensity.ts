import type { TrainingScienceConfig } from "../config/training-science.config";
import type { Activity, HrZoneId } from "../types";
import { zoneKeyToBucket } from "./zoneBucket";

export interface IntensityDistribution {
  easyPct: number;
  moderatePct: number;
  hardPct: number;
  targetEasyPct: number;
  /** easyPct - targetEasyPct; negative means training harder/more polarized-incorrectly than the 80/20 target. */
  deviationPct: number;
  totalSecondsWithZoneData: number;
}

/**
 * Time-in-zone based easy/moderate/hard split across all running activities
 * that have a HR-zone breakdown (config.intensityDistribution.zoneBuckets
 * maps the 5 device zones onto Seiler's 3-zone model). Activities without
 * zone data (CSV/Strava imports) are excluded rather than guessed at -
 * returns null if no run has zone data at all, so the caller can render an
 * explicit "not enough data" state instead of a misleading 0/0/0 split.
 */
export function computeIntensityDistribution(
  activities: Activity[],
  config: TrainingScienceConfig,
): IntensityDistribution | null {
  const { easy, moderate, hard } = config.intensityDistribution.zoneBuckets;
  const easySet = new Set<HrZoneId>(easy);
  const moderateSet = new Set<HrZoneId>(moderate);
  const hardSet = new Set<HrZoneId>(hard);

  let easySeconds = 0;
  let moderateSeconds = 0;
  let hardSeconds = 0;

  for (const activity of activities) {
    if (activity.sport !== "run" || !activity.hrZoneSeconds) continue;

    for (const [key, seconds] of Object.entries(activity.hrZoneSeconds)) {
      const bucket = zoneKeyToBucket(key);
      if (!bucket || seconds == null) continue;

      if (easySet.has(bucket)) easySeconds += seconds;
      else if (moderateSet.has(bucket)) moderateSeconds += seconds;
      else if (hardSet.has(bucket)) hardSeconds += seconds;
    }
  }

  const total = easySeconds + moderateSeconds + hardSeconds;
  if (total === 0) return null;

  const easyPct = (easySeconds / total) * 100;

  return {
    easyPct,
    moderatePct: (moderateSeconds / total) * 100,
    hardPct: (hardSeconds / total) * 100,
    targetEasyPct: config.intensityDistribution.targetEasyPct,
    deviationPct: easyPct - config.intensityDistribution.targetEasyPct,
    totalSecondsWithZoneData: total,
  };
}
