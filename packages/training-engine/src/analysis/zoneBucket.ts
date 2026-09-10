import type { HrZoneId } from "../types";

/**
 * Folds a raw zone key (which may include "z0" for "time below zone 1", or
 * an out-of-range value from a differently-configured device) onto one of
 * our five known buckets, rather than trusting the caller's typing. Shared
 * by load.ts and intensity.ts, both of which iterate a device's raw
 * hr_zone_seconds breakdown.
 */
export function zoneKeyToBucket(key: string): HrZoneId | null {
  const match = /^z(\d+)$/.exec(key);
  if (!match) return null;
  const n = Number(match[1]);
  if (n <= 1) return "z1";
  if (n === 2) return "z2";
  if (n === 3) return "z3";
  if (n === 4) return "z4";
  return "z5";
}
