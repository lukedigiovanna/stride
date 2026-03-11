import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { UserExerciseProgress } from '@/types';

interface UseExerciseProgressReturn {
  progress: UserExerciseProgress | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Writes an updated progress row. Uses upsert so it works both for
   * creating the first row and updating an existing one.
   */
  upsertProgress: (data: Partial<Omit<UserExerciseProgress, 'id'>>) => Promise<void>;
}

/**
 * Loads and manages the current user's progress for a single exercise.
 * Returns null progress if the user has never logged this exercise before.
 *
 * @param exerciseId - The exercise to load progress for.
 */
export function useExerciseProgress(exerciseId: string): UseExerciseProgressReturn {
  const { user } = useAuth();
  const [progress, setProgress] = useState<UserExerciseProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !exerciseId) return;

    setIsLoading(true);
    setError(null);

    supabase
      .from('user_exercise_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('exercise_id', exerciseId)
      .maybeSingle()
      .then(({ data, error: dbError }) => {
        if (dbError) {
          setError(dbError.message);
        } else {
          setProgress(data as UserExerciseProgress | null);
        }
        setIsLoading(false);
      });
  }, [user, exerciseId]);

  const upsertProgress = useCallback(
    async (updates: Partial<Omit<UserExerciseProgress, 'id'>>) => {
      if (!user) throw new Error('Not authenticated.');

      const payload = { user_id: user.id, exercise_id: exerciseId, ...updates };

      const { data, error: dbError } = await supabase
        .from('user_exercise_progress')
        .upsert(payload, { onConflict: 'user_id,exercise_id' })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);
      setProgress(data as UserExerciseProgress);
    },
    [user, exerciseId],
  );

  return { progress, isLoading, error, upsertProgress };
}
