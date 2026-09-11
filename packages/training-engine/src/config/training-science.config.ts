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

import type { PlanPhaseType, WorkoutType } from "../types";

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
    // A week counts as "missed" for the two rules below once at least this
    // many of its non-rest planned_workouts ended up status="missed" (not
    // necessarily every single one - a lone easy run logged in an otherwise
    // abandoned week still counts as missed).
    consecutiveMissedDaysForVolumeReduction: number;
    overreachAcwrThreshold: number;
    // A missed week (see above) reduces the *following* week's target
    // volume by this percentage, relative to the missed week's own
    // (already lower, pre-ramp) target - not the following week's
    // already-higher ramped target - so the ramp effectively steps back
    // one week instead of just continuing upward from a week that didn't
    // happen.
    volumeReductionOnMissedWeekPct: number;
    // This many consecutive missed weeks (see above) trigger a full phase
    // regression: the plan is regenerated from today with the same race
    // date and the old plan marked superseded, rather than patching volume.
    missedWeeksForPhaseRegression: number;
    // The overtraining guard's response when triggered (ramp-rate violation
    // or ACWR over threshold): the next not-yet-started week is converted
    // into an inserted recovery week at this volume reduction, rather than
    // literally inserting a 8th day into the calendar (which would either
    // push the fixed race date or compress a later week - both worse).
    recoveryWeekVolumeReductionPct: number;
    source: string;
  };

  strengthTraining: {
    countsAsLoad: boolean;
    isProgrammed: boolean;
  };

  planning: {
    // Fallback ceiling for weekly running volume when the plan isn't
    // anchored to a race-time goal (this app deliberately has none in v1).
    // A generic "comfortable recreational marathon finish" target - the
    // single most made-up number in this whole config, confirm with the
    // app owner before relying on it.
    defaultPeakWeeklyVolumeKm: number;
    // Long run as a fraction of that week's total volume.
    longRunPctOfWeeklyVolume: number;
    longRunMaxKm: number;
    // Race-week volume as a fraction of the last pre-taper week's volume.
    taperRaceWeekVolumePct: number;
    // Fixed Monday-Sunday workout-type pattern per phase. The volume
    // generator splits that week's target km across every non-rest slot
    // (long_run gets its own share, the rest split evenly across the
    // remaining slots - quality sessions are not weighted differently by
    // distance in v1, only by effort/pace target).
    weeklyTemplates: Record<PlanPhaseType, WorkoutType[]>;
    source: string;
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
    overreachAcwrThreshold: 1.5,
    volumeReductionOnMissedWeekPct: 20,
    missedWeeksForPhaseRegression: 3,
    recoveryWeekVolumeReductionPct: 35,
    source: "TODO: cite (e.g. acute:chronic workload ratio literature)",
  },

  strengthTraining: {
    countsAsLoad: true,
    isProgrammed: false,
  },

  planning: {
    defaultPeakWeeklyVolumeKm: 60,
    longRunPctOfWeeklyVolume: 0.32,
    longRunMaxKm: 32,
    taperRaceWeekVolumePct: 0.4,
    weeklyTemplates: {
      base: ["rest", "easy", "easy", "rest", "easy", "rest", "long_run"],
      build: ["rest", "tempo", "easy", "easy", "rest", "easy", "long_run"],
      specific: ["rest", "intervals", "easy", "tempo", "rest", "easy", "long_run"],
      taper: ["rest", "tempo", "easy", "rest", "rest", "easy", "long_run"],
    },
    source:
      "TODO: cite - generic recreational-marathon weekly structure and peak-volume guideline, " +
      "not calibrated to the app owner's goals; confirm before Phase 3 is considered done",
  },
};
