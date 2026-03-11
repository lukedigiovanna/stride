import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { BodyweightLog } from '@/types';

interface UseBodyweightLogsReturn {
  /** All bodyweight logs for the user, newest first. */
  logs: BodyweightLog[];
  /**
   * Average bodyweight (in lbs) over the last 7 days.
   * Null if no logs exist in that window.
   */
  sevenDayAvgLbs: number | null;
  isLoading: boolean;
  error: string | null;
  /** Logs a new bodyweight entry (value in lbs). */
  logWeight: (weightLbs: number, notes?: string) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
}

/**
 * Loads and manages bodyweight logs for the current user.
 * Computes the 7-day rolling average used as the default
 * weight for bodyweight exercises in the workout logger.
 */
export function useBodyweightLogs(): UseBodyweightLogsReturn {
  const { user } = useAuth();
  const [logs, setLogs] = useState<BodyweightLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setError(null);

    const { data, error: dbError } = await supabase
      .from('bodyweight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false });

    if (dbError) {
      setError(dbError.message);
    } else {
      setLogs((data ?? []) as BodyweightLog[]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    fetchLogs().finally(() => setIsLoading(false));
  }, [user, fetchLogs]);

  /** Compute 7-day rolling average from in-memory logs. */
  const sevenDayAvgLbs: number | null = (() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = logs.filter(
      (l) => new Date(l.logged_at).getTime() >= cutoff,
    );
    if (recent.length === 0) return null;
    return recent.reduce((sum, l) => sum + l.weight_lbs, 0) / recent.length;
  })();

  const logWeight = useCallback(
    async (weightLbs: number, notes?: string) => {
      if (!user) throw new Error('Not authenticated.');

      const { data, error: dbError } = await supabase
        .from('bodyweight_logs')
        .insert({ user_id: user.id, weight_lbs: weightLbs, notes: notes ?? null })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);
      // Prepend so the list stays newest-first
      setLogs((prev) => [data as BodyweightLog, ...prev]);
    },
    [user],
  );

  const deleteLog = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not authenticated.');

      const { error: dbError } = await supabase
        .from('bodyweight_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (dbError) throw new Error(dbError.message);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    },
    [user],
  );

  return { logs, sevenDayAvgLbs, isLoading, error, logWeight, deleteLog };
}
