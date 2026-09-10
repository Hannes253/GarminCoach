import type { WeeklyVolumePoint } from "./volume";

export interface LongRunPoint {
  weekStart: string;
  longRunKm: number;
}

/** Long-run progression over time - one point per week that had at least one run. */
export function trackLongRunProgression(weeklyVolume: WeeklyVolumePoint[]): LongRunPoint[] {
  return weeklyVolume.map((w) => ({ weekStart: w.weekStart, longRunKm: w.longRunKm }));
}
