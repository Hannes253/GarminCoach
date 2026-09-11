import type { PlanPhase, PlannedWorkout, PlanWeek, TrainingPlan } from "@garmincoach/training-engine";
import type { Database } from "@/lib/supabase/types.generated";

type TrainingPlanInsert = Database["public"]["Tables"]["training_plans"]["Insert"];
type PlanPhaseInsert = Database["public"]["Tables"]["plan_phases"]["Insert"];
type PlanWeekInsert = Database["public"]["Tables"]["plan_weeks"]["Insert"];
type PlannedWorkoutInsert = Database["public"]["Tables"]["planned_workouts"]["Insert"];

export function trainingPlanToInsert(plan: TrainingPlan, userId: string): TrainingPlanInsert {
  return {
    id: plan.id,
    user_id: userId,
    race_date: plan.raceDate,
    status: plan.status,
    generation_reason: plan.generationReason,
    superseded_by_plan_id: plan.supersededByPlanId,
  };
}

export function planPhaseToInsert(phase: PlanPhase, planId: string, userId: string): PlanPhaseInsert {
  return {
    id: phase.id,
    user_id: userId,
    plan_id: planId,
    phase_type: phase.phaseType,
    start_date: phase.startDate,
    end_date: phase.endDate,
    sequence_order: phase.sequenceOrder,
    target_weekly_volume_km: phase.targetWeeklyVolumeKm,
  };
}

export function planWeekToInsert(week: PlanWeek, userId: string): PlanWeekInsert {
  return {
    id: week.id,
    user_id: userId,
    phase_id: week.phaseId,
    week_start_date: week.weekStartDate,
    week_number: week.weekNumber,
    is_deload: week.isDeload,
    target_volume_km: week.targetVolumeKm,
    target_long_run_km: week.targetLongRunKm,
    status: week.status,
  };
}

export function plannedWorkoutToInsert(workout: PlannedWorkout, userId: string): PlannedWorkoutInsert {
  return {
    id: workout.id,
    user_id: userId,
    plan_week_id: workout.planWeekId,
    date: workout.date,
    sequence_in_week: workout.sequenceInWeek,
    workout_type: workout.workoutType,
    target_distance_km: workout.targetDistanceKm,
    target_duration_minutes: workout.targetDurationMinutes,
    target_pace_range: workout.targetPaceRange,
    target_hr_zone: workout.targetHrZone,
    status: workout.status,
    completed_activity_id: workout.completedActivityId,
  };
}
