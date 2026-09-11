import type { TrainingScienceConfig } from "../config/training-science.config";
import type { PlanPhase, PlanPhaseType, PlanWeek, TrainingPlan } from "../types";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week containing (or starting on) the given date. */
function mondayOnOrAfter(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysToNextMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  return addDays(dateStr, daysToNextMonday);
}

function fullWeeksBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDateStr}T00:00:00.000Z`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24 * 7));
}

/**
 * Splits the weeks available before taper across base/build/specific. Below
 * the combined minimum (a short lead time), the minimums themselves are
 * scaled down proportionally rather than ignored. At or above it, each
 * phase gets its minimum plus a share of the leftover weeks proportional to
 * targetPctOfLeadTime.
 */
function distributePhaseWeeks(
  remainingWeeks: number,
  config: TrainingScienceConfig,
): { base: number; build: number; specific: number } {
  const { base, build, specific } = config.phaseLengths;
  const minSum = base.minWeeks + build.minWeeks + specific.minWeeks;

  if (remainingWeeks <= 0) return { base: 0, build: 0, specific: 0 };

  if (remainingWeeks < minSum) {
    const scale = remainingWeeks / minSum;
    const scaledBase = Math.max(1, Math.round(base.minWeeks * scale));
    const scaledBuild = Math.max(1, Math.round(build.minWeeks * scale));
    const scaledSpecific = Math.max(0, remainingWeeks - scaledBase - scaledBuild);
    return { base: scaledBase, build: scaledBuild, specific: scaledSpecific };
  }

  const extraWeeks = remainingWeeks - minSum;
  const totalPct = base.targetPctOfLeadTime + build.targetPctOfLeadTime + specific.targetPctOfLeadTime;
  const extraBase = Math.round(extraWeeks * (base.targetPctOfLeadTime / totalPct));
  const extraBuild = Math.round(extraWeeks * (build.targetPctOfLeadTime / totalPct));

  const finalBase = base.minWeeks + extraBase;
  const finalBuild = build.minWeeks + extraBuild;
  const finalSpecific = remainingWeeks - finalBase - finalBuild; // absorbs rounding

  return { base: finalBase, build: finalBuild, specific: finalSpecific };
}

export interface GeneratePlanParams {
  raceDate: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
  /** Current weekly running volume, e.g. the average of the last 2-3 weeks from computeWeeklyVolume. */
  currentWeeklyVolumeKm: number;
  config: TrainingScienceConfig;
  generationReason?: TrainingPlan["generationReason"];
}

export interface GeneratedPlan {
  plan: TrainingPlan;
  weeks: PlanWeek[];
}

/**
 * Backwards-periodizes from raceDate: base -> build -> specific -> a fixed
 * taper. Weekly volume ramps by up to rampRate.maxWeeklyVolumeIncreasePct
 * each week (capped at planning.defaultPeakWeeklyVolumeKm), with a deload
 * week every deload.cadenceWeeks; the deload's reduced volume becomes the
 * base the following week ramps from, rather than snapping back to the
 * pre-deload peak. Taper decreases linearly from the last pre-taper week's
 * volume to planning.taperRaceWeekVolumePct of it in race week.
 *
 * The structured plan itself never spans more than
 * planning.structuredWindowWeeks before the race, even if raceDate is much
 * further out than that: it starts at max(today, raceDate -
 * structuredWindowWeeks), rounded to the following Monday. Time before that
 * anchor is intentionally outside any plan - a classic 16-24 week marathon
 * block, not a training structure stretched across however long the actual
 * lead time to the race happens to be.
 *
 * ID generation uses crypto.randomUUID() (available in both Node and
 * browsers) - the only non-deterministic part of an otherwise pure
 * function; every date/volume calculation depends only on the explicit
 * `today` and `raceDate` params.
 */
export function generatePlan(params: GeneratePlanParams): GeneratedPlan {
  const { raceDate, today, config } = params;
  const currentWeeklyVolumeKm = params.currentWeeklyVolumeKm > 0 ? params.currentWeeklyVolumeKm : 15;

  const todayMonday = mondayOnOrAfter(today);
  const earliestStructuredStart = mondayOnOrAfter(addDays(raceDate, -config.planning.structuredWindowWeeks * 7));
  const startMonday = todayMonday > earliestStructuredStart ? todayMonday : earliestStructuredStart;
  const totalWeeks = Math.max(1, fullWeeksBetween(startMonday, raceDate));
  const taperWeeks = Math.min(config.phaseLengths.taper.fixedWeeks, totalWeeks);
  const remainingWeeks = totalWeeks - taperWeeks;

  const { base: baseWeeks, build: buildWeeks, specific: specificWeeks } = distributePhaseWeeks(
    remainingWeeks,
    config,
  );

  const allPhaseDefs: Array<{ type: PlanPhaseType; weekCount: number }> = [
    { type: "base", weekCount: baseWeeks },
    { type: "build", weekCount: buildWeeks },
    { type: "specific", weekCount: specificWeeks },
    { type: "taper", weekCount: taperWeeks },
  ];
  const phaseDefs = allPhaseDefs.filter((p) => p.weekCount > 0);

  const phases: PlanPhase[] = [];
  let cursor = startMonday;
  for (let i = 0; i < phaseDefs.length; i++) {
    const def = phaseDefs[i]!;
    const startDate = cursor;
    const endDate = addDays(cursor, def.weekCount * 7 - 1);
    phases.push({
      id: crypto.randomUUID(),
      phaseType: def.type,
      startDate,
      endDate,
      sequenceOrder: i,
      targetWeeklyVolumeKm: null, // filled in below once weekly volumes are known
    });
    cursor = addDays(cursor, def.weekCount * 7);
  }

  const weeks: PlanWeek[] = [];
  let volume = currentWeeklyVolumeKm;
  let preTaperVolume = currentWeeklyVolumeKm;
  let cadenceCounter = 0;
  let weekNumber = 1;

  for (let pi = 0; pi < phaseDefs.length; pi++) {
    const def = phaseDefs[pi]!;
    const phase = phases[pi]!;
    const phaseVolumes: number[] = [];

    for (let w = 0; w < def.weekCount; w++) {
      const weekStartDate = addDays(phase.startDate, w * 7);
      let isDeload = false;
      let targetVolumeKm: number;

      if (def.type === "taper") {
        const t = def.weekCount === 1 ? 1 : w / (def.weekCount - 1);
        const raceWeekVolume = preTaperVolume * config.planning.taperRaceWeekVolumePct;
        targetVolumeKm = preTaperVolume - t * (preTaperVolume - raceWeekVolume);
      } else {
        cadenceCounter++;
        isDeload =
          config.deload.appliesToPhases.includes(def.type) && cadenceCounter % config.deload.cadenceWeeks === 0;
        targetVolumeKm = isDeload
          ? volume * (1 - config.deload.volumeReductionPct / 100)
          : Math.min(
              volume * (1 + config.rampRate.maxWeeklyVolumeIncreasePct / 100),
              config.planning.defaultPeakWeeklyVolumeKm,
            );
        volume = targetVolumeKm;
        preTaperVolume = volume;
      }

      const longRunKm = Math.min(
        config.planning.longRunMaxKm,
        targetVolumeKm * config.planning.longRunPctOfWeeklyVolume,
      );

      phaseVolumes.push(targetVolumeKm);
      weeks.push({
        id: crypto.randomUUID(),
        phaseId: phase.id,
        weekStartDate,
        weekNumber: weekNumber++,
        isDeload,
        targetVolumeKm: Math.round(targetVolumeKm * 10) / 10,
        targetLongRunKm: Math.round(longRunKm * 10) / 10,
        status: "planned",
      });
    }

    phase.targetWeeklyVolumeKm =
      Math.round((phaseVolumes.reduce((a, b) => a + b, 0) / phaseVolumes.length) * 10) / 10;
  }

  const plan: TrainingPlan = {
    id: crypto.randomUUID(),
    raceDate,
    status: "active",
    generationReason: params.generationReason ?? "initial",
    supersededByPlanId: null,
    phases,
  };

  return { plan, weeks };
}
