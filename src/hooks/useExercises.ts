import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Exercise, ExerciseCategory, EquipmentType } from '@/types';

export interface CreateExerciseInput {
  name: string;
  category: ExerciseCategory;
  equipment_type: EquipmentType;
}

interface UseExercisesReturn {
  /** Global exercises + user-created exercises, sorted by category then name. */
  exercises: Exercise[];
  isLoading: boolean;
  error: string | null;
  /** Creates a new user-owned exercise and appends it to the list. */
  createExercise: (input: CreateExerciseInput) => Promise<Exercise>;
  /** Re-fetches the full exercise list from the server. */
  refetch: () => Promise<void>;
}

/**
 * Loads all exercises visible to the current user:
 *   - Global exercises (user_id IS NULL)
 *   - The user's own custom exercises
 *
 * The RLS policy on the exercises table enforces this server-side.
 */
export function useExercises(): UseExercisesReturn {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true });

      if (dbError) throw new Error(dbError.message);
      setExercises((data ?? []) as Exercise[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises.');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    fetchExercises().finally(() => setIsLoading(false));
  }, [user, fetchExercises]);

  const createExercise = useCallback(
    async (input: CreateExerciseInput): Promise<Exercise> => {
      if (!user) throw new Error('Not authenticated.');

      const { data, error: dbError } = await supabase
        .from('exercises')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      const created = data as Exercise;
      setExercises((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return created;
    },
    [user],
  );

  return { exercises, isLoading, error, createExercise, refetch: fetchExercises };
}
