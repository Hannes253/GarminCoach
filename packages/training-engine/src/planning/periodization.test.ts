import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "../config/training-science.config";
import type { PlanPhaseType } from "../types";
import { generatePlan } from "./periodization";

const config = defaultTrainingScienceConfig;

describe("generatePlan", () => {
  it("real-user scenario: race ~12 months out, structured window capped, rebuilding from <20km/week", () => {
    const { plan, weeks } = generatePlan({
      raceDate: "2027-09-26", // Berlin Marathon
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    expect(plan.raceDate).toBe("2027-09-26");
    expect(plan.status).toBe("active");
    expect(plan.generationReason).toBe("initial");

    const phaseTypes = plan.phases.map((p) => p.phaseType);
    expect(phaseTypes).toEqual(["base", "build", "specific", "taper"]);

    // Phases are contiguous, non-overlapping, in ascending order.
    for (let i = 1; i < plan.phases.length; i++) {
      const prevEnd = new Date(`${plan.phases[i - 1]!.endDate}T00:00:00.000Z`);
      const nextStart = new Date(`${plan.phases[i]!.startDate}T00:00:00.000Z`);
      expect(nextStart.getTime() - prevEnd.getTime()).toBe(24 * 60 * 60 * 1000);
    }

    // Taper is exactly the configured fixed length and ends on/before race week.
    const taper = plan.phases.find((p) => p.phaseType === "taper")!;
    const taperWeekCount = weeks.filter((w) => w.phaseId === taper.id).length;
    expect(taperWeekCount).toBe(config.phaseLengths.taper.fixedWeeks);

    // Volume never exceeds the configured peak, and never jumps by more than
    // the ramp-rate limit week over week (deload weeks are an explicit drop,
    // never counted against the ramp check).
    for (let i = 1; i < weeks.length; i++) {
      const prev = weeks[i - 1]!;
      const curr = weeks[i]!;
      expect(curr.targetVolumeKm).toBeLessThanOrEqual(config.planning.defaultPeakWeeklyVolumeKm + 0.1);
      if (!curr.isDeload && !prev.isDeload) {
        const maxAllowed = prev.targetVolumeKm * (1 + config.rampRate.maxWeeklyVolumeIncreasePct / 100) + 0.1;
        expect(curr.targetVolumeKm).toBeLessThanOrEqual(maxAllowed);
      }
    }

    // At least one deload week occurs within the ~24-week structured window.
    expect(weeks.some((w) => w.isDeload)).toBe(true);

    // Long run never exceeds the configured cap.
    for (const week of weeks) {
      expect(week.targetLongRunKm).toBeLessThanOrEqual(config.planning.longRunMaxKm + 0.1);
    }

    // Race week volume is meaningfully reduced from peak.
    const lastWeek = weeks.at(-1)!;
    const peakVolume = Math.max(...weeks.map((w) => w.targetVolumeKm));
    expect(lastWeek.targetVolumeKm).toBeLessThan(peakVolume);

    // Every week belongs to a phase that exists in the plan.
    const phaseIds = new Set(plan.phases.map((p) => p.id));
    for (const week of weeks) {
      expect(phaseIds.has(week.phaseId)).toBe(true);
    }

    // Week numbers are sequential starting at 1.
    expect(weeks.map((w) => w.weekNumber)).toEqual(weeks.map((_, i) => i + 1));
  });

  it("caps the structured window at structuredWindowWeeks before the race when the race is far out", () => {
    const { plan } = generatePlan({
      raceDate: "2027-09-26", // Berlin Marathon, ~12 months from "today" below
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    const firstPhase = plan.phases[0]!;
    const raceMs = new Date("2027-09-26T00:00:00.000Z").getTime();
    const todayMs = new Date("2026-09-11T00:00:00.000Z").getTime();
    const firstPhaseStartMs = new Date(`${firstPhase.startDate}T00:00:00.000Z`).getTime();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    // Structured plan starts close to structuredWindowWeeks before the race,
    // not immediately after "today" - most of the year stays outside any plan.
    const weeksBeforeRace = (raceMs - firstPhaseStartMs) / weekMs;
    expect(weeksBeforeRace).toBeLessThanOrEqual(config.planning.structuredWindowWeeks + 1);
    expect(weeksBeforeRace).toBeGreaterThan(config.planning.structuredWindowWeeks - 4);

    const gapWeeks = (firstPhaseStartMs - todayMs) / weekMs;
    expect(gapWeeks).toBeGreaterThan(20);
  });

  it("does not cap the window when the race is already within structuredWindowWeeks", () => {
    const { plan } = generatePlan({
      raceDate: "2026-11-20", // ~10 weeks out, well under the 24-week window
      today: "2026-09-11",
      currentWeeklyVolumeKm: 25,
      config,
    });

    // Starts right away (the Monday on/after today), the full lead time is used.
    expect(plan.phases[0]!.startDate).toBe("2026-09-14");
  });

  it("short lead time (10 weeks): scales phase minimums down but still produces a taper", () => {
    const { plan, weeks } = generatePlan({
      raceDate: "2026-11-20",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 25,
      config,
    });

    const phaseTypes = plan.phases.map((p) => p.phaseType);
    expect(phaseTypes[phaseTypes.length - 1]).toBe("taper");
    expect(weeks.length).toBeGreaterThan(0);

    for (const week of weeks) {
      expect(week.targetVolumeKm).toBeGreaterThan(0);
    }
  });

  it("very short lead time (2 weeks): still returns a valid plan without throwing", () => {
    const { plan, weeks } = generatePlan({
      raceDate: "2026-09-25",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 30,
      config,
    });

    expect(plan.phases.length).toBeGreaterThan(0);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.every((w) => w.targetVolumeKm > 0)).toBe(true);
  });

  it("already-high starting volume: ramp is capped at defaultPeakWeeklyVolumeKm, never exceeds it", () => {
    const { weeks } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 55,
      config,
    });

    for (const week of weeks) {
      expect(week.targetVolumeKm).toBeLessThanOrEqual(config.planning.defaultPeakWeeklyVolumeKm + 0.1);
    }
  });

  it("zero or negative currentWeeklyVolumeKm falls back to a conservative starting volume", () => {
    const { weeks } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 0,
      config,
    });

    expect(weeks[0]!.targetVolumeKm).toBeGreaterThan(0);
    expect(weeks[0]!.targetVolumeKm).toBeLessThan(20);
  });

  it("deload weeks apply the configured volume reduction relative to the prior week", () => {
    const { weeks } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    const deloadIndices = weeks.reduce<number[]>((acc, w, i) => {
      if (w.isDeload) acc.push(i);
      return acc;
    }, []);
    expect(deloadIndices.length).toBeGreaterThan(0);

    for (const idx of deloadIndices) {
      expect(idx).toBeGreaterThan(0);
      const prev = weeks[idx - 1]!;
      const curr = weeks[idx]!;
      const expected = prev.targetVolumeKm * (1 - config.deload.volumeReductionPct / 100);
      expect(curr.targetVolumeKm).toBeCloseTo(expected, 0);
    }
  });

  it("no deload weeks occur inside the taper phase", () => {
    const { plan, weeks } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    const taper = plan.phases.find((p) => p.phaseType === "taper")!;
    const taperWeeks = weeks.filter((w) => w.phaseId === taper.id);
    expect(taperWeeks.every((w) => !w.isDeload)).toBe(true);
  });

  it("phase startDate always falls on a Monday", () => {
    const { plan } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    for (const phase of plan.phases) {
      const d = new Date(`${phase.startDate}T00:00:00.000Z`);
      expect(d.getUTCDay()).toBe(1); // Monday
    }
  });

  it("respects a custom generationReason", () => {
    const { plan } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
      generationReason: "regression_after_break",
    });

    expect(plan.generationReason).toBe("regression_after_break");
  });

  it("each phase's targetWeeklyVolumeKm is the average of its weeks' targetVolumeKm", () => {
    const { plan, weeks } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    for (const phase of plan.phases) {
      const phaseWeeks = weeks.filter((w) => w.phaseId === phase.id);
      const avg = phaseWeeks.reduce((a, w) => a + w.targetVolumeKm, 0) / phaseWeeks.length;
      expect(phase.targetWeeklyVolumeKm).toBeCloseTo(avg, 1);
    }
  });

  it("all four phase types are valid PlanPhaseType values", () => {
    const { plan } = generatePlan({
      raceDate: "2027-09-26",
      today: "2026-09-11",
      currentWeeklyVolumeKm: 18,
      config,
    });

    const valid: PlanPhaseType[] = ["base", "build", "specific", "taper"];
    for (const phase of plan.phases) {
      expect(valid).toContain(phase.phaseType);
    }
  });
});
