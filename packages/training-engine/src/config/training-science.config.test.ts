import { describe, expect, it } from "vitest";
import { defaultTrainingScienceConfig } from "./training-science.config";

describe("defaultTrainingScienceConfig", () => {
  it("defines exactly five HR zones covering z1 through z5", () => {
    const ids = defaultTrainingScienceConfig.hrZones.map((z) => z.id);
    expect(ids).toEqual(["z1", "z2", "z3", "z4", "z5"]);
  });

  it("targets an 80/20 polarized intensity split", () => {
    const { targetEasyPct, targetHardPct } = defaultTrainingScienceConfig.intensityDistribution;
    expect(targetEasyPct + targetHardPct).toBe(100);
    expect(targetEasyPct).toBe(80);
  });

  it("excludes taper from the deload cadence", () => {
    expect(defaultTrainingScienceConfig.deload.appliesToPhases).not.toContain("taper");
  });

  it("marks strength training as load-only, never programmed", () => {
    expect(defaultTrainingScienceConfig.strengthTraining.countsAsLoad).toBe(true);
    expect(defaultTrainingScienceConfig.strengthTraining.isProgrammed).toBe(false);
  });
});
