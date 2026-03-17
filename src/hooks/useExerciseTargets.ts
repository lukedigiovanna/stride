import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { ExerciseTarget } from '@/types';

type TargetFields = Pick<
  ExerciseTarget,
  | 'target_sets_min'
  | 'target_sets_max'
  | 'target_reps_min'
  | 'target_reps_max'
  | 'target_rest_seconds_min'
  | 'target_rest_seconds_max'
>;

interface UseExerciseTargetsResult {
  target: ExerciseTarget | null;
  isLoading: boolean;
  upsertTarget: (values: Partial<TargetFields>) => Promise<void>;
  clearTarget: () => Promise<void>;
}

export function useExerciseTargets(exerciseId: string): UseExerciseTargetsResult {
  const { user } = useAuth();
  const [target, setTarget] = useState<ExerciseTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('user_exercise_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('exercise_id', exerciseId)
      .maybeSingle();
    setTarget((data as ExerciseTarget) ?? null);
    setIsLoading(false);
  }, [user, exerciseId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertTarget = useCallback(
    async (values: Partial<TargetFields>) => {
      if (!user) return;
      const { data } = await supabase
        .from('user_exercise_targets')
        .upsert(
          { user_id: user.id, exercise_id: exerciseId, ...values },
          { onConflict: 'user_id,exercise_id' },
        )
        .select()
        .single();
      setTarget((data as ExerciseTarget) ?? null);
    },
    [user, exerciseId],
  );

  const clearTarget = useCallback(async () => {
    if (!user || !target) return;
    await supabase
      .from('user_exercise_targets')
      .delete()
      .eq('id', target.id)
      .eq('user_id', user.id);
    setTarget(null);
  }, [user, target]);

  return { target, isLoading, upsertTarget, clearTarget };
}
