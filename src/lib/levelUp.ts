import type { Exercise, UserExerciseProgress, WorkoutSet, LevelUpResult } from '@/types';

/**
 * Determines whether a user has met the level target for an exercise during
 * a workout session, and returns the updated progress if they have levelled up.
 *
 * Level-up conditions (all must be true):
 *   1. The exercise has a level system (level_increment_lbs is not null).
 *   2. The exercise has a defined weight target (level_target_weight_lbs is not null).
 *   3. The number of sets where weight_lbs >= target AND reps >= target
 *      is >= level_target_sets.
 *
 * @param sets     - All sets logged for this exercise in the current workout.
 * @param progress - The user's current progress row for this exercise.
 * @param exercise - The exercise definition (needed for level_increment_lbs).
 * @returns A LevelUpResult containing the new progress row, or null if no level-up.
 */
export const checkLevelUp = (
  sets: WorkoutSet[],
  progress: UserExerciseProgress,
  exercise: Exercise,
): LevelUpResult | null => {
  // Cardio and bodyweight-tracked exercises have no level system
  if (exercise.level_increment_lbs === null) return null;
  if (progress.level_target_weight_lbs === null) return null;

  const { level_target_weight_lbs, level_target_reps, level_target_sets } = progress;

  const qualifyingSets = sets.filter(
    (s) =>
      s.weight_lbs >= level_target_weight_lbs &&
      s.reps >= level_target_reps,
  );

  if (qualifyingSets.length < level_target_sets) return null;

  // User has hit the target — compute the next level's targets
  const newLevel = progress.current_level + 1;
  const newTargetWeight = level_target_weight_lbs + exercise.level_increment_lbs;

  const newProgress: UserExerciseProgress = {
    ...progress,
    current_level: newLevel,
    level_target_weight_lbs: newTargetWeight,
    // Rep and set targets stay the same across levels
    updated_at: new Date().toISOString(),
  };

  return {
    exercise,
    previousLevel: progress.current_level,
    newLevel,
    newProgress,
  };
};

/**
 * Returns the initial UserExerciseProgress for an exercise a user has
 * never logged before.
 *
 * Starting targets:
 *   - Weight: the exercise's first level_increment_lbs value (i.e. level 1 = first increment)
 *   - Reps: 12 (standard starting target)
 *   - Sets: 3
 *
 * For exercises with no level system (bodyweight/cardio), returns null.
 */
export const createInitialProgress = (
  userId: string,
  exercise: Exercise,
): Omit<UserExerciseProgress, 'id' | 'updated_at'> | null => {
  if (exercise.level_increment_lbs === null) return null;

  return {
    user_id: userId,
    exercise_id: exercise.id,
    current_level: 1,
    level_target_weight_lbs: exercise.level_increment_lbs,
    level_target_reps: 12,
    level_target_sets: 3,
  };
};

/**
 * Returns a human-readable description of the current level target.
 * e.g. "3 × 12 @ 25 lbs"
 */
export const formatLevelTarget = (progress: UserExerciseProgress): string => {
  const weight =
    progress.level_target_weight_lbs !== null
      ? ` @ ${progress.level_target_weight_lbs} lbs`
      : '';
  return `${progress.level_target_sets} × ${progress.level_target_reps}${weight}`;
};
