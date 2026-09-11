import { Encoder, Profile } from "@garmin/fitsdk";
import type { Encodable, FileIdMesg, WorkoutMesg, WorkoutStepMesg } from "@garmin/fitsdk";
import type { WorkoutType } from "@garmincoach/training-engine";

const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  easy: "Locker",
  long_run: "Langer Lauf",
  tempo: "Tempolauf",
  intervals: "Intervalle",
  recovery: "Regeneration",
  rest: "Ruhetag",
};

export interface WorkoutFitInput {
  workoutType: WorkoutType;
  targetDistanceKm: number;
}

/**
 * Builds a single-step FIT workout file for one day's planned run: a
 * distance goal with no pace/HR target, matching the v1 scope decision in
 * training-science.config.ts (planning.source) that planned workouts don't
 * carry computed pace/HR zones yet. Garmin Connect accepts a manually
 * uploaded/imported workout FIT file from any source, so no device pairing
 * or manufacturer registration is required - manufacturer "development" is
 * the same placeholder the FIT SDK's own docs use for non-Garmin encoders.
 */
export function buildWorkoutFitFile(input: WorkoutFitInput): Uint8Array {
  const encoder = new Encoder();
  const name = `${WORKOUT_TYPE_LABELS[input.workoutType]} ${input.targetDistanceKm} km`;

  const fileId: Encodable<FileIdMesg> = {
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "workout",
    manufacturer: "development",
    product: 0,
    timeCreated: new Date(),
  };
  encoder.writeMesg(fileId);

  const workout: Encodable<WorkoutMesg> = {
    mesgNum: Profile.MesgNum.WORKOUT,
    sport: "running",
    numValidSteps: 1,
    wktName: name,
  };
  encoder.writeMesg(workout);

  const step: Encodable<WorkoutStepMesg> = {
    mesgNum: Profile.MesgNum.WORKOUT_STEP,
    messageIndex: 0,
    wktStepName: name,
    durationType: "distance",
    // The Encoder only writes base field names, not the decoder's expanded
    // subfield names - durationDistance (scale 100, meters) is a subfield of
    // durationValue selected by durationType, so it must be written as a
    // pre-scaled raw value under durationValue, not as durationDistance.
    durationValue: Math.round(input.targetDistanceKm * 1000 * 100),
    targetType: "open",
    intensity: "active",
  };
  encoder.writeMesg(step);

  return encoder.close();
}
