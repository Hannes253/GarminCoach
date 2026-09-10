/**
 * Central training-science configuration.
 *
 * Every assumption here (zone boundaries, load formulas, ramp-rate limits,
 * phase lengths, deload cadence, adaptation thresholds) is a claim about
 * exercise physiology, not a software default. Each one carries a `source`
 * field. Entries marked "TODO: cite" are placeholders the app owner has not
 * yet reviewed/confirmed against a real methodology and must be checked
 * before the phase that depends on them (planning uses zones/phaseLengths,
 * adaptation uses adaptationThresholds/deload) is considered done.
 *
 * No function in this package reads this object as a hidden singleton -
 * it is always passed in explicitly as a parameter, so tests can override
 * it and a future settings UI can make it user-tunable without changing
 * any function signature.
 */

export type ZoneMethodology = "threshold_relative" | "pct_hrr" | "pct_hrmax";

export interface TrainingScienceConfig {
  version: string;

  zoneMethodology: {
    method: ZoneMethodology;
    source: string;
  };

  hrZones: Array<{
    id: "z1" | "z2" | "z3" | "z4" | "z5";
    name: string;
    minPct: number;
    maxPct: number;
    source: string;
  }>;

  loadModel: {
    atlWindowDays: number;
    ctlWindowDays: number;
    tsbFormula: "ctl_minus_atl";
    runLoadMethod: "duration_x_hrZoneIntensityFactor";
    strengthLoadMethod: "sessionRPE_x_durationMinutes";
    // Per-zone multiplier for minutes spent in that zone, summed into one
    // load score (Edwards' Summated Heart-Rate-Zone score). Zone "z0" in a
    // device's raw time-in-zone breakdown (time below zone 1) is folded
    // into the z1 weight if present.
    zoneLoadWeights: Record<"z1" | "z2" | "z3" | "z4" | "z5", number>;
    // Fallback intensity factor (multiplies duration directly) used only
    // when an activity has no hr_zone_seconds breakdown at all (e.g. a CSV
    // or Strava import) - deliberately conservative/neutral.
    noZoneDataFallbackFactor: number;
    zoneLoadSource: string;
    source: string;
  };

  // TSB ("form") interpretation bands, standard Training Stress Balance
  // convention (positive = fresh, very negative = high fatigue/injury risk).
  formStatus: {
    freshMin: number;
    fatiguedMax: number;
    veryFatiguedMax: number;
    source: string;
  };

  intensityDistribution: {
    targetEasyPct: number;
    targetHardPct: number;
    method: "polarized";
    // Maps the 5 device HR zones onto Seiler's 3-zone polarized model.
    // "z0" (time below zone 1) is folded into "easy" if present.
    zoneBuckets: {
      easy: Array<"z1" | "z2">;
      moderate: Array<"z3">;
      hard: Array<"z4" | "z5">;
    };
    zoneBucketsSource: string;
    source: string;
  };

  rampRate: {
    maxWeeklyVolumeIncreasePct: number;
    source: string;
  };

  deload: {
    cadenceWeeks: number;
    volumeReductionPct: number;
    appliesToPhases: Array<"base" | "build" | "specific" | "taper">;
    source: string;
  };

  phaseLengths: {
    base: { minWeeks: number; targetPctOfLeadTime: number };
    build: { minWeeks: number; targetPctOfLeadTime: number };
    specific: { minWeeks: number; targetPctOfLeadTime: number };
    taper: { fixedWeeks: number };
    source: string;
  };

  adaptationThresholds: {
    consecutiveMissedDaysForVolumeReduction: number;
    longBreakThresholdDays: number;
    overreachAcwrThreshold: number;
    volumeReductionOnLongBreakPct: number;
    source: string;
  };

  strengthTraining: {
    countsAsLoad: boolean;
    isProgrammed: boolean;
  };
}

export const defaultTrainingScienceConfig: TrainingScienceConfig = {
  version: "0.1.0",

  zoneMethodology: {
    method: "threshold_relative",
    source: "TODO: cite (e.g. Daniels / Friel / Coggan) - confirm with app owner before Phase 3",
  },

  hrZones: [
    { id: "z1", name: "Recovery", minPct: 0, maxPct: 68, source: "TODO: cite" },
    { id: "z2", name: "Easy / Aerobic", minPct: 69, maxPct: 83, source: "TODO: cite" },
    { id: "z3", name: "Moderate", minPct: 84, maxPct: 94, source: "TODO: cite" },
    { id: "z4", name: "Threshold", minPct: 95, maxPct: 105, source: "TODO: cite" },
    { id: "z5", name: "VO2max+", minPct: 106, maxPct: 999, source: "TODO: cite" },
  ],

  loadModel: {
    atlWindowDays: 7,
    ctlWindowDays: 28,
    tsbFormula: "ctl_minus_atl",
    runLoadMethod: "duration_x_hrZoneIntensityFactor",
    strengthLoadMethod: "sessionRPE_x_durationMinutes",
    zoneLoadWeights: { z1: 1, z2: 2, z3: 3, z4: 4, z5: 5 },
    noZoneDataFallbackFactor: 1,
    zoneLoadSource: "Edwards' Summated Heart-Rate-Zone score (Edwards, 1993) - confirm weighting with app owner",
    source:
      "TODO: cite (session-RPE per Foster et al.; 28-day CTL window chosen per app owner's request, " +
      "deliberately shorter than TrainingPeaks' standard 42-day window - confirm)",
  },

  formStatus: {
    freshMin: 5,
    fatiguedMax: -10,
    veryFatiguedMax: -30,
    source: "Standard TSB interpretation bands (Coggan/TrainingPeaks convention) - confirm bucket edges with app owner",
  },

  intensityDistribution: {
    targetEasyPct: 80,
    targetHardPct: 20,
    method: "polarized",
    zoneBuckets: { easy: ["z1", "z2"], moderate: ["z3"], hard: ["z4", "z5"] },
    zoneBucketsSource:
      "5-zone -> 3-zone mapping onto Seiler's polarized model - confirm z2/z3 boundary matches app owner's aerobic threshold",
    source: "TODO: cite (e.g. Seiler polarized training research)",
  },

  rampRate: {
    maxWeeklyVolumeIncreasePct: 10,
    source: "TODO: cite (common coaching heuristic, a.k.a. the '10% rule')",
  },

  deload: {
    cadenceWeeks: 4, // 3 build weeks : 1 deload week
    volumeReductionPct: 35,
    appliesToPhases: ["base", "build", "specific"],
    source: "TODO: cite - taper intentionally excluded, uses its own monotonic reduction curve instead",
  },

  phaseLengths: {
    base: { minWeeks: 8, targetPctOfLeadTime: 0.4 },
    build: { minWeeks: 6, targetPctOfLeadTime: 0.3 },
    specific: { minWeeks: 6, targetPctOfLeadTime: 0.2 },
    taper: { fixedWeeks: 3 },
    source: "TODO: cite",
  },

  adaptationThresholds: {
    consecutiveMissedDaysForVolumeReduction: 3,
    longBreakThresholdDays: 14,
    overreachAcwrThreshold: 1.5,
    volumeReductionOnLongBreakPct: 25,
    source: "TODO: cite (e.g. acute:chronic workload ratio literature)",
  },

  strengthTraining: {
    countsAsLoad: true,
    isProgrammed: false,
  },
};
