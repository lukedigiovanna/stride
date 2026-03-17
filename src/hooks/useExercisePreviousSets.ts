import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { WorkoutSet } from '@/types';

export interface PreviousExerciseData {
  lastWorkedAt: string;
  sets: WorkoutSet[];
}

/**
 * For each exercise the user has ever done, returns the sets from the most
 * recent completed workout — excluding the current active workout.
 *
 * Fetched once when currentWorkoutId is first set; never re-fetched during
 * the session so the sort order and reference data remain stable.
 */
export function useExercisePreviousSets(
  currentWorkoutId: string | null,
): Map<string, PreviousExerciseData> {
  const { user } = useAuth();
  const [data, setData] = useState<Map<string, PreviousExerciseData>>(new Map());

  useEffect(() => {
    if (!user || !currentWorkoutId) return;

    let cancelled = false;

    async function load() {
      // Step 1: Get exercise_id + workout_id + logged_at for all historical sets,
      // ordered newest-first so we can pick the most recent workout per exercise.
      const { data: rows } = await supabase
        .from('sets')
        .select('exercise_id, workout_id, logged_at')
        .eq('user_id', user!.id)
        .neq('workout_id', currentWorkoutId)
        .order('logged_at', { ascending: false })
        .limit(2000);

      if (cancelled || !rows || rows.length === 0) return;

      // Step 2: Find the most recent workout_id per exercise (first row seen = newest).
      const exToWorkout = new Map<string, { workoutId: string; lastWorkedAt: string }>();
      for (const row of rows as { exercise_id: string; workout_id: string; logged_at: string }[]) {
        if (!exToWorkout.has(row.exercise_id)) {
          exToWorkout.set(row.exercise_id, {
            workoutId: row.workout_id,
            lastWorkedAt: row.logged_at,
          });
        }
      }

      if (exToWorkout.size === 0) return;

      // Step 3: Fetch all sets for those workout_ids (full row data for display).
      const workoutIds = [...new Set([...exToWorkout.values()].map((v) => v.workoutId))];
      const { data: setsData } = await supabase
        .from('sets')
        .select('*')
        .eq('user_id', user!.id)
        .in('workout_id', workoutIds)
        .order('set_number', { ascending: true });

      if (cancelled || !setsData) return;

      const allSets = setsData as WorkoutSet[];

      // Step 4: Build result map — for each exercise, collect sets from its most
      // recent previous workout.
      const result = new Map<string, PreviousExerciseData>();
      for (const [exerciseId, { workoutId, lastWorkedAt }] of exToWorkout) {
        const exerciseSets = allSets.filter(
          (s) => s.exercise_id === exerciseId && s.workout_id === workoutId,
        );
        if (exerciseSets.length > 0) {
          result.set(exerciseId, { lastWorkedAt, sets: exerciseSets });
        }
      }

      setData(result);
    }

    load();
    return () => { cancelled = true; };
  // Only run once per workout session — currentWorkoutId won't change mid-session.
  }, [user?.id, currentWorkoutId]);

  return data;
}
