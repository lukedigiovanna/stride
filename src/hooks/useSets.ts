import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { calcStrengthSetXP, calcCardioSetXP } from '@/lib/xp';
import type { WorkoutSet, Exercise } from '@/types';

interface UseSetMutationsReturn {
  /**
   * Updates the weight and reps of an existing set (used in History editing).
   * Does NOT recalculate or adjust XP — XP corrections on historical sets
   * are out of scope to avoid confusing the leaderboard.
   */
  updateSet: (setId: string, weightLbs: number, reps: number) => Promise<WorkoutSet>;
  /**
   * Deletes a set and subtracts its XP contribution from profiles.total_xp.
   * @param set      - The set to delete (needed to compute XP to subtract).
   * @param exercise - The exercise the set belongs to (needed for XP formula).
   */
  deleteSet: (set: WorkoutSet, exercise: Exercise) => Promise<void>;
}

/**
 * Provides mutation functions for sets that already exist in the database.
 * Used primarily in the History detail view for editing/deleting past sets.
 *
 * For sets in an active workout, use WorkoutContext instead.
 */
export function useSets(): UseSetMutationsReturn {
  const { user } = useAuth();

  const updateSet = useCallback(
    async (setId: string, weightLbs: number, reps: number): Promise<WorkoutSet> => {
      if (!user) throw new Error('Not authenticated.');

      const { data, error } = await supabase
        .from('sets')
        .update({ weight_lbs: weightLbs, reps })
        .eq('id', setId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as WorkoutSet;
    },
    [user],
  );

  const deleteSet = useCallback(
    async (set: WorkoutSet, exercise: Exercise): Promise<void> => {
      if (!user) throw new Error('Not authenticated.');

      // 1. Delete the set row
      const { error: delError } = await supabase
        .from('sets')
        .delete()
        .eq('id', set.id)
        .eq('user_id', user.id);

      if (delError) throw new Error(delError.message);

      // 2. Subtract this set's XP from profiles.total_xp
      const xpToSubtract =
        exercise.category === 'cardio'
          ? calcCardioSetXP(set.weight_lbs, set.reps)
          : calcStrengthSetXP(set.weight_lbs, set.reps);

      // Use an RPC or a read-then-write to decrement safely
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', user.id)
        .single();

      if (profileErr) throw new Error(profileErr.message);

      const currentXp = (profileData as { total_xp: number }).total_xp;
      const newXp = Math.max(0, currentXp - xpToSubtract);

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ total_xp: newXp })
        .eq('id', user.id);

      if (updateErr) throw new Error(updateErr.message);
    },
    [user],
  );

  return { updateSet, deleteSet };
}
