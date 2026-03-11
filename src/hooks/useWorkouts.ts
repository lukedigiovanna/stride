import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Workout } from '@/types';

const PAGE_SIZE = 20;

interface UseWorkoutsReturn {
  /** Completed workouts only (ended_at IS NOT NULL), newest first. */
  workouts: Workout[];
  isLoading: boolean;
  error: string | null;
  /** True if there are more workouts to load from the server. */
  hasMore: boolean;
  /** Appends the next page of workouts. */
  loadMore: () => Promise<void>;
  /** Re-fetches from page 1. */
  refetch: () => Promise<void>;
}

/**
 * Paginates completed workouts for the current user, newest first.
 * Only returns workouts where ended_at IS NOT NULL.
 */
export function useWorkouts(): UseWorkoutsReturn {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchPage = useCallback(
    async (pageIndex: number, replace: boolean) => {
      if (!user) return;
      setError(null);

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: dbError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .range(from, to);

      if (dbError) {
        setError(dbError.message);
        return;
      }

      const rows = (data ?? []) as Workout[];
      setHasMore(rows.length === PAGE_SIZE);
      setWorkouts((prev) => (replace ? rows : [...prev, ...rows]));
    },
    [user],
  );

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    fetchPage(0, true).finally(() => setIsLoading(false));
  }, [user, fetchPage]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchPage(nextPage, false);
  }, [page, fetchPage]);

  const refetch = useCallback(async () => {
    setPage(0);
    setIsLoading(true);
    await fetchPage(0, true);
    setIsLoading(false);
  }, [fetchPage]);

  return { workouts, isLoading, error, hasMore, loadMore, refetch };
}
