/**
 * Domain types for the training engine. These are plain data shapes with no
 * dependency on Supabase's generated row types — the Next.js app maps
 * between the two in apps/web/lib/mappers.
 */

export type Sport = "run" | "bike" | "strength" | "other";

export type HrZoneId = "z1" | "z2" | "z3" | "z4" | "z5";

export type HrZoneSeconds = Partial<Record<HrZoneId, number>>;

export interface Activity {
  id: string;
  sport: Sport;
  startTime: string; // ISO 8601
  durationSeconds: number;
  distanceMeters: number | null;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  maxHr: number | null;
  hrZoneSeconds: HrZoneSeconds | null;
  elevationGainMeters: number | null;
  avgCadence: number | null;
  rpe: number | null; // 1-10, from activity_manual_fields
}

export interface DailyLog {
  logDate: string; // YYYY-MM-DD
  sleepHours: number | null;
  sleepQuality: number | null;
  note: string | null;
}

export type PlanPhaseType = "base" | "build" | "specific" | "taper";

export interface PlanPhase {
  id: string;
  phaseType: PlanPhaseType;
  startDate: string;
  endDate: string;
  sequenceOrder: number;
  targetWeeklyVolumeKm: number | null;
}

export interface PlanWeek {
  id: string;
  phaseId: string;
  weekStartDate: string;
  weekNumber: number;
  isDeload: boolean;
  targetVolumeKm: number;
  targetLongRunKm: number | null;
  status: "planned" | "active" | "completed";
}

export type WorkoutType =
  | "easy"
  | "long_run"
  | "tempo"
  | "intervals"
  | "recovery"
  | "rest";

export interface PlannedWorkout {
  id: string;
  planWeekId: string;
  date: string;
  sequenceInWeek: number;
  workoutType: WorkoutType;
  targetDistanceKm: number | null;
  targetDurationMinutes: number | null;
  targetPaceRange: { minSecPerKm: number; maxSecPerKm: number } | null;
  targetHrZone: HrZoneId | null;
  status: "planned" | "completed" | "missed" | "skipped_replanned" | "modified";
  completedActivityId: string | null;
}

export interface TrainingPlan {
  id: string;
  raceDate: string;
  status: "active" | "superseded" | "draft";
  generationReason: "initial" | "regression_after_break" | "manual_regenerate";
  supersededByPlanId: string | null;
  phases: PlanPhase[];
}

export type PlanAdjustmentTriggerType =
  | "missed_single_session"
  | "missed_consecutive_days"
  | "long_break"
  | "overtraining_ramp"
  | "manual";

export interface PlanAdjustment {
  id: string;
  planId: string;
  triggeredAt: string;
  triggerType: PlanAdjustmentTriggerType;
  triggerContext: Record<string, unknown>;
  ruleApplied: string;
  rationaleText: string;
  affectedWeekIds: string[];
}

export interface UserZones {
  hrZones: Record<HrZoneId, { minPct: number; maxPct: number }>;
  paceZones: Record<HrZoneId, { minSecPerKm: number; maxSecPerKm: number }>;
}

export interface Warning {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  context: Record<string, unknown>;
}
