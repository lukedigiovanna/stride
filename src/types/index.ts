// ─── Enums / Literal Types ───────────────────────────────────────────────────

/** The six exercise categories shown in the workout accordion and filter tabs. */
export type ExerciseCategory = 'legs' | 'push' | 'pull' | 'core' | 'cardio' | 'misc';

/**
 * Equipment type for an exercise.
 * Drives UI hints (e.g. bodyweight exercises pre-fill the user's bodyweight).
 * Cardio exercises are identified by category === 'cardio', not equipment_type.
 */
export type EquipmentType =
  | 'dumbbell'
  | 'barbell'
  | 'cable'
  | 'bodyweight'
  | 'machine'
  | 'other';

/** The unit in which the user prefers to view and enter weights. */
export type WeightUnit = 'lbs' | 'kg';

/** ISO day of week, lower-case. Used for the progress photo reminder setting. */
export type DayOfWeek =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

// ─── DB Row Interfaces ────────────────────────────────────────────────────────
// Each interface mirrors a table in public schema exactly (snake_case columns).

/** DB row — public.profiles */
export interface Profile {
  /** UUID — matches auth.users(id) */
  id: string;
  display_name: string | null;
  weight_unit: WeightUnit;
  /** Running total of XP across all time. Updated on set log/delete. */
  total_xp: number;
  /** HH:MM:SS format. Null = reminder disabled. */
  bodyweight_reminder_time: string | null;
  /** Null = reminder disabled. */
  progress_photo_reminder_day: DayOfWeek | null;
  created_at: string;
  updated_at: string;
}

/** DB row — public.exercises */
export interface Exercise {
  id: string;
  /** Null = global/default exercise shared across all users. */
  user_id: string | null;
  name: string;
  category: ExerciseCategory;
  equipment_type: EquipmentType;
  /**
   * Weight increment (in lbs) between exercise levels.
   * Null for bodyweight exercises and cardio (no level system).
   */
  level_increment_lbs: number | null;
  created_at: string;
}

/** DB row — public.user_exercise_progress */
export interface UserExerciseProgress {
  id: string;
  user_id: string;
  exercise_id: string;
  /** Current level for this exercise. Starts at 1. */
  current_level: number;
  /**
   * Weight (lbs) required to qualify a set for the current level target.
   * Null for bodyweight exercises.
   */
  level_target_weight_lbs: number | null;
  /** Reps required per qualifying set. */
  level_target_reps: number;
  /** Number of qualifying sets required to advance to the next level. */
  level_target_sets: number;
  updated_at: string;
}

/** DB row — public.workouts */
export interface Workout {
  id: string;
  user_id: string;
  started_at: string;
  /** Null while the workout session is still in progress. */
  ended_at: string | null;
  notes: string | null;
  /** Total XP awarded for this workout. Written when the session is closed. */
  xp_earned: number;
  created_at: string;
}

/**
 * DB row — public.sets
 *
 * For cardio exercises the fields carry different semantics:
 *   weight_lbs  → distance (in miles or km, user preference)
 *   reps        → duration in minutes
 */
export interface WorkoutSet {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_id: string;
  /** 1-indexed position within the exercise for this workout session. */
  set_number: number;
  /** Stored in lbs. For cardio: distance value (unit depends on user preference). */
  weight_lbs: number;
  /** Reps performed. For cardio: duration in minutes. */
  reps: number;
  logged_at: string;
  notes: string | null;
}

/** DB row — public.bodyweight_logs */
export interface BodyweightLog {
  id: string;
  user_id: string;
  /** Always stored in lbs. Converted at display time via user's weight_unit. */
  weight_lbs: number;
  logged_at: string;
  notes: string | null;
}

/** DB row — public.progress_photos */
export interface ProgressPhoto {
  id: string;
  user_id: string;
  /** Path within the Supabase Storage bucket: {user_id}/{photo_id}.{ext} */
  storage_path: string;
  /** ISO date string (YYYY-MM-DD). May differ from uploaded_at. */
  taken_on: string;
  notes: string | null;
  uploaded_at: string;
}

// ─── View Model / App-Layer Types ────────────────────────────────────────────
// These are computed or composed in the application layer and never stored in DB.

/**
 * An exercise enriched with the current user's progress for that exercise.
 * Used in the exercise list and workout accordion cards.
 */
export interface ExerciseWithProgress extends Exercise {
  /** Null if the user has never logged a set for this exercise. */
  progress: UserExerciseProgress | null;
}

/**
 * One exercise's sets within an active workout session,
 * grouped for display in the workout accordion.
 */
export interface ActiveExerciseEntry {
  exercise: Exercise;
  sets: WorkoutSet[];
  /** ISO string of the most recently logged set — used for sort order in the accordion. */
  lastLoggedAt: string | null;
}

/**
 * The full state of an in-progress workout.
 * Held in WorkoutContext and serialised to localStorage for crash recovery.
 */
export interface ActiveWorkout {
  workoutId: string;
  startedAt: string;
  /**
   * Map of exerciseId → ActiveExerciseEntry.
   * Using a Record lets O(1) lookups when a set is logged.
   */
  entries: Record<string, ActiveExerciseEntry>;
}

/**
 * A completed workout with all sets and exercises fully resolved.
 * Used in the History detail view and the post-workout summary modal.
 */
export interface WorkoutDetail {
  workout: Workout;
  entries: WorkoutDetailEntry[];
  /** Sum of (weight_lbs × reps) for all non-cardio sets. */
  totalVolumeLbs: number;
  totalSets: number;
}

/** One exercise's contribution within a WorkoutDetail. */
export interface WorkoutDetailEntry {
  exercise: Exercise;
  sets: WorkoutSet[];
  /** The user's exercise progress record at the time the workout was performed. */
  progressAtTime: UserExerciseProgress | null;
}

/**
 * Returned by WorkoutContext.finishWorkout().
 * Carries everything the post-workout summary and level-up overlay need.
 */
export interface FinishWorkoutResult {
  xpEarned: number;
  levelUps: LevelUpResult[];
  previousTotalXp: number;
  newTotalXp: number;
}

/**
 * Describes a single exercise level-up event.
 * Used to trigger per-exercise toasts and the summary callout.
 */
export interface LevelUpResult {
  exercise: Exercise;
  previousLevel: number;
  newLevel: number;
  /** The updated UserExerciseProgress row to be written to the DB. */
  newProgress: UserExerciseProgress;
}

/**
 * Gamification state derived from a profile's total_xp.
 * Computed entirely client-side — never stored in the DB.
 */
export interface GamificationState {
  totalXp: number;
  currentLevel: number;
  currentRank: string;
  /** XP accumulated since the start of the current level. */
  xpIntoCurrentLevel: number;
  /** Total XP needed to complete the current level (span, not absolute threshold). */
  xpRequiredForNextLevel: number;
  /** Null if the user is at the highest defined rank. */
  nextRank: string | null;
}

/** State of the rest timer held in WorkoutContext. */
export interface RestTimerState {
  isActive: boolean;
  secondsRemaining: number;
  /** The duration the timer resets to when Reset is tapped. */
  durationSeconds: number;
}
