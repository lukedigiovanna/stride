import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type {
  WorkoutDetail,
  WorkoutDetailEntry,
  Workout,
  WorkoutSet,
  Exercise,
} from '@/types';

interface UseWorkoutDetailReturn {
  detail: WorkoutDetail | null;
  isLoading: boolean;
  error: string | null;
  /** Saves free-text notes on the workout row. */
  updateNotes: (notes: string) => Promise<void>;
  /**
   * Deletes the entire workout and all of its sets.
   * The caller is responsible for subtracting xp_earned from profiles.total_xp.
   */
  deleteWorkout: () => Promise<void>;
}

/**
 * Fetches a single completed workout with all its sets and the exercise
 * definitions for each set, assembled into a WorkoutDetail view model.
 */
export function useWorkoutDetail(workoutId: string): UseWorkoutDetailReturn {
  const { user } = useAuth();
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!user || !workoutId) return;
    setIsLoading(true);
    setError(null);

    // 1. Fetch the workout row
    const { data: workoutData, error: wErr } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .single();

    if (wErr || !workoutData) {
      setError(wErr?.message ?? 'Workout not found.');
      return;
    }

    const workout = workoutData as Workout;

    // 2. Fetch all sets for this workout
    const { data: setsData, error: sErr } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_id', workoutId)
      .order('logged_at', { ascending: true });

    if (sErr) { setError(sErr.message); return; }
    const sets = (setsData ?? []) as WorkoutSet[];

    // 3. Fetch the unique exercises referenced by those sets
    const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
    let exercises: Exercise[] = [];

    if (exerciseIds.length > 0) {
      const { data: exData, error: exErr } = await supabase
        .from('exercises')
        .select('*')
        .in('id', exerciseIds);

      if (exErr) { setError(exErr.message); return; }
      exercises = (exData ?? []) as Exercise[];
    }

    // 4. Group sets by exercise and build WorkoutDetailEntry[]
    const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
    const setsByExercise = new Map<string, WorkoutSet[]>();

    for (const set of sets) {
      const group = setsByExercise.get(set.exercise_id) ?? [];
      group.push(set);
      setsByExercise.set(set.exercise_id, group);
    }

    const entries: WorkoutDetailEntry[] = exerciseIds
      .map((id) => ({
        exercise: exerciseMap.get(id)!,
        sets: setsByExercise.get(id) ?? [],
      }))
      .filter((e) => e.exercise != null);

    // 6. Compute totals
    const totalVolumeLbs = sets.reduce(
      (sum, s) => sum + s.weight_lbs * s.reps,
      0,
    );

    setDetail({
      workout,
      entries,
      totalVolumeLbs,
      totalSets: sets.length,
    });
  }, [user, workoutId]);

  useEffect(() => {
    fetchDetail().finally(() => setIsLoading(false));
  }, [fetchDetail]);

  const updateNotes = useCallback(
    async (notes: string) => {
      if (!workoutId) return;
      const { error: dbError } = await supabase
        .from('workouts')
        .update({ notes })
        .eq('id', workoutId);

      if (dbError) throw new Error(dbError.message);
      setDetail((prev) =>
        prev ? { ...prev, workout: { ...prev.workout, notes } } : prev,
      );
    },
    [workoutId],
  );

  const deleteWorkout = useCallback(async () => {
    if (!workoutId) return;
    // Sets are deleted by cascade (FK on delete cascade in the schema)
    const { error: dbError } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId);

    if (dbError) throw new Error(dbError.message);
    setDetail(null);
  }, [workoutId]);

  return { detail, isLoading, error, updateNotes, deleteWorkout };
}
