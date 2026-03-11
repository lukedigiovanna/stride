import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile } from '@/types';

type UpdatableProfileFields = Pick<
  Profile,
  | 'display_name'
  | 'weight_unit'
  | 'bodyweight_reminder_time'
  | 'progress_photo_reminder_day'
>;

interface UseProfileReturn {
  profile: Profile | null;
  isLoading: boolean;
  /** Writes partial updates to Supabase and patches the in-memory profile via AuthContext. */
  updateProfile: (updates: Partial<UpdatableProfileFields>) => Promise<void>;
}

/**
 * Thin wrapper around AuthContext that also provides a `updateProfile` mutation.
 * Prefer this hook over directly reading from AuthContext in UI components.
 */
export function useProfile(): UseProfileReturn {
  const { user, profile, isLoading, updateProfile: patchLocal } = useAuth();

  const updateProfile = useCallback(
    async (updates: Partial<UpdatableProfileFields>) => {
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw new Error(error.message);

      // Patch the in-memory profile so the UI updates immediately
      patchLocal(updates);
    },
    [user, patchLocal],
  );

  return { profile, isLoading, updateProfile };
}
