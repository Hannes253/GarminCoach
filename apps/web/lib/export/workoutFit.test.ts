import { Decoder, Stream } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";
import { buildWorkoutFitFile } from "./workoutFit";

function decode(bytes: Uint8Array) {
  const stream = Stream.fromByteArray(Array.from(bytes));
  const decoder = new Decoder(stream);
  return { decoder, ...decoder.read() };
}

describe("buildWorkoutFitFile", () => {
  it("produces a valid, integrity-checked FIT file", () => {
    const bytes = buildWorkoutFitFile({ workoutType: "long_run", targetDistanceKm: 18 });
    const stream = Stream.fromByteArray(Array.from(bytes));
    expect(Decoder.isFIT(stream)).toBe(true);

    const decoder = new Decoder(stream);
    expect(decoder.checkIntegrity()).toBe(true);
  });

  it("round-trips through the Decoder with the expected workout + step data", () => {
    const bytes = buildWorkoutFitFile({ workoutType: "tempo", targetDistanceKm: 10 });
    const { messages, errors } = decode(bytes);

    expect(errors).toHaveLength(0);
    expect(messages.fileIdMesgs?.[0]?.type).toBe("workout");

    const workout = messages.workoutMesgs?.[0];
    expect(workout?.sport).toBe("running");
    expect(workout?.numValidSteps).toBe(1);

    const step = messages.workoutStepMesgs?.[0];
    expect(step?.durationType).toBe("distance");
    expect(step?.durationDistance).toBeCloseTo(10000, 0);
    expect(step?.targetType).toBe("open");
    expect(step?.intensity).toBe("active");
  });

  it("includes the target distance in the workout name for every workout type", () => {
    for (const workoutType of ["easy", "long_run", "tempo", "intervals", "recovery"] as const) {
      const bytes = buildWorkoutFitFile({ workoutType, targetDistanceKm: 8 });
      const { messages } = decode(bytes);
      expect(messages.workoutMesgs?.[0]?.wktName).toContain("8");
    }
  });

  it("scales distance correctly for fractional km", () => {
    const bytes = buildWorkoutFitFile({ workoutType: "easy", targetDistanceKm: 6.4 });
    const { messages } = decode(bytes);
    expect(messages.workoutStepMesgs?.[0]?.durationDistance).toBeCloseTo(6400, 0);
  });
});
