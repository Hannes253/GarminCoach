import type { NormalizedActivityInput } from "./types";

/**
 * SHA-256 of raw file bytes, for exact re-import detection (Tier 1). Runs on
 * both the main thread and inside a Web Worker via SubtleCrypto.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Normalized natural key (Tier 2) computed identically regardless of source,
 * so the same activity imported once via FIT and once via CSV collapses to
 * one row instead of duplicating. Rounding absorbs the precision difference
 * between FIT (sub-second) and Garmin's CSV export (minute/second).
 */
export function computeDedupKey(input: NormalizedActivityInput): string {
  const startTimeMinute = new Date(input.startTime);
  startTimeMinute.setSeconds(0, 0);

  const durationRounded = roundToNearest(input.durationSeconds, 5);
  const distanceRounded =
    input.distanceMeters == null ? "na" : roundToNearest(input.distanceMeters, 10);

  return [startTimeMinute.toISOString(), input.sport, durationRounded, distanceRounded].join("|");
}
