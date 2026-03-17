import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { calcStrengthSetXP, calcCardioSetXP } from '@/lib/xp';
import {
  type PendingSetInsert,
  loadQueue,
  saveQueue,
  enqueue,
  dequeue,
} from '@/lib/offlineQueue';
import type {
  ActiveWorkout,
  ActiveExerciseEntry,
  Exercise,
  ExerciseTarget,
  WorkoutSet,
  FinishWorkoutResult,
  RestTimerState,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'stride_active_workout';

// ─── Context type ─────────────────────────────────────────────────────────────

interface WorkoutContextValue {
  // ── State ──────────────────────────────────────────────────────────────────
  activeWorkout: ActiveWorkout | null;
  isWorkoutActive: boolean;
  /** Controls the workout bottom sheet open/close state. */
  isSheetOpen: boolean;
  setIsSheetOpen: (open: boolean) => void;

  // ── Workout lifecycle ──────────────────────────────────────────────────────
  startWorkout: () => Promise<void>;
  /**
   * Closes the workout: calculates XP, writes results to DB, runs level-up
   * checks, clears local state, and returns the full result for the summary UI.
   */
  finishWorkout: () => Promise<FinishWorkoutResult>;
  /** Deletes all sets and the workout row without awarding XP. */
  discardWorkout: () => Promise<void>;

  // ── Set management ─────────────────────────────────────────────────────────
  /**
   * Logs a new set. Takes the full Exercise object so that initial progress
   * rows can be created on first use without a separate lookup.
   */
  logSet: (
    exercise: Exercise,
    weightLbs: number,
    reps: number,
    notes?: string,
  ) => Promise<void>;
  updateSet: (setId: string, weightLbs: number, reps: number) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;

  /** Map of exerciseId → ExerciseTarget for all of the user's targets. */
  exerciseTargets: Map<string, ExerciseTarget>;

  // ── Rest timer ─────────────────────────────────────────────────────────────
  restTimer: RestTimerState;
  startRestTimer: () => void;
  resumeRestTimer: () => void;
  resetRestTimer: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveToStorage(workout: ActiveWorkout | null) {
  if (workout) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workout));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadFromStorage(): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveWorkout) : null;
  } catch {
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updateProfile } = useAuth();

  const [activeWorkout, setActiveWorkoutRaw] = useState<ActiveWorkout | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [exerciseTargets, setExerciseTargets] = useState<Map<string, ExerciseTarget>>(new Map());
  const [restTimer, setRestTimer] = useState<RestTimerState>({
    status: 'idle',
    elapsedMs: 0,
    startTime: null,
  });

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ── Screen wake lock ────────────────────────────────────────────────────────

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Silently fail — not critical
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Acquire/release based on active workout
  useEffect(() => {
    if (activeWorkout) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [activeWorkout, acquireWakeLock, releaseWakeLock]);

  // Re-acquire after page becomes visible again (wake lock is auto-released on hide)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeWorkout) {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeWorkout, acquireWakeLock]);

  /** Wrapper that also persists to localStorage on every change. */
  const setActiveWorkout = useCallback((next: ActiveWorkout | null) => {
    setActiveWorkoutRaw(next);
    saveToStorage(next);
  }, []);

  // ── Hydration ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const hydrate = async () => {
      // 1. Try to restore from localStorage first (instant)
      const stored = loadFromStorage();

      // 2. Check DB for an open workout — DB is the source of truth
      const { data: openWorkout } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!openWorkout) {
        // No open workout in DB — clear any stale localStorage data
        if (stored) saveToStorage(null);
        return;
      }

      // 3. Fetch all sets for the open workout from DB
      const { data: setsData } = await supabase
        .from('sets')
        .select('*')
        .eq('workout_id', openWorkout.id)
        .order('logged_at', { ascending: true });

      const sets = (setsData ?? []) as WorkoutSet[];

      // 4. Get the exercise objects for those sets
      const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
      let exercises: Exercise[] = [];

      if (exerciseIds.length > 0) {
        const { data: exData } = await supabase
          .from('exercises')
          .select('*')
          .in('id', exerciseIds);
        exercises = (exData ?? []) as Exercise[];
      }

      // 5. Rebuild entries map
      const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
      const entries: Record<string, ActiveExerciseEntry> = {};

      for (const set of sets) {
        const ex = exerciseMap.get(set.exercise_id);
        if (!ex) continue;
        if (!entries[set.exercise_id]) {
          entries[set.exercise_id] = {
            exercise: ex,
            sets: [],
            lastLoggedAt: null,
          };
        }
        entries[set.exercise_id].sets.push(set);
        entries[set.exercise_id].lastLoggedAt = set.logged_at;
      }

      // Use the stored startedAt if it matches, else use the DB value
      const openWorkoutRow = openWorkout as { id: string; started_at: string };
      const startedAt =
        stored !== null && stored.workoutId === openWorkoutRow.id
          ? stored.startedAt
          : openWorkoutRow.started_at;

      setActiveWorkoutRaw({
        workoutId: openWorkout.id as string,
        startedAt,
        entries,
      });
      saveToStorage({ workoutId: openWorkout.id as string, startedAt, entries });
    };

    hydrate();
  // Only run once on mount / user change
  }, [user?.id]);

  // ── Exercise targets fetch ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_exercise_targets')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map = new Map<string, ExerciseTarget>();
        for (const row of (data ?? []) as ExerciseTarget[]) {
          map.set(row.exercise_id, row);
        }
        setExerciseTargets(map);
      });
  }, [user?.id]);

  // ── Rest timer tick ────────────────────────────────────────────────────────

  useEffect(() => {
    if (restTimer.status === 'running') {
      timerIntervalRef.current = setInterval(() => {
        // Force re-render; elapsed time is computed from startTime on each render.
        setRestTimer((prev) => ({ ...prev }));
      }, 10);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [restTimer.status]);

  // ── Workout lifecycle ──────────────────────────────────────────────────────

  const startWorkout = useCallback(async () => {
    if (!user) throw new Error('Not authenticated.');

    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const workout = data as { id: string; started_at: string };
    const newActive: ActiveWorkout = {
      workoutId: workout.id,
      startedAt: workout.started_at,
      entries: {},
    };

    setActiveWorkout(newActive);
    setIsSheetOpen(true);
  }, [user, setActiveWorkout]);

  const finishWorkout = useCallback(async (): Promise<FinishWorkoutResult> => {
    if (!activeWorkout || !user) throw new Error('No active workout.');

    const entries = Object.values(activeWorkout.entries);
    const previousTotalXp = profile?.total_xp ?? 0;
    let xpEarned = 0;

    // 1. Calculate total XP across all sets
    for (const entry of entries) {
      for (const set of entry.sets) {
        xpEarned +=
          entry.exercise.category === 'cardio'
            ? calcCardioSetXP(set.weight_lbs, set.reps)
            : calcStrengthSetXP(set.weight_lbs, set.reps);
      }
    }

    const newTotalXp = previousTotalXp + xpEarned;

    // 2. Close the workout row in DB
    const { error: wErr } = await supabase
      .from('workouts')
      .update({ ended_at: new Date().toISOString(), xp_earned: xpEarned })
      .eq('id', activeWorkout.workoutId);

    if (wErr) throw new Error(wErr.message);

    // 3. Increment total_xp on the profile
    const { error: pErr } = await supabase
      .from('profiles')
      .update({ total_xp: newTotalXp })
      .eq('id', user.id);

    if (pErr) throw new Error(pErr.message);
    updateProfile({ total_xp: newTotalXp });

    // 4. Clear state
    setActiveWorkout(null);
    setIsSheetOpen(false);

    return { xpEarned, previousTotalXp, newTotalXp };
  }, [activeWorkout, user, profile, setActiveWorkout, updateProfile]);

  const discardWorkout = useCallback(async () => {
    if (!activeWorkout) return;

    // Cascade delete removes sets automatically
    await supabase
      .from('workouts')
      .delete()
      .eq('id', activeWorkout.workoutId);

    setActiveWorkout(null);
    setIsSheetOpen(false);
  }, [activeWorkout, setActiveWorkout]);

  // ── Set management ─────────────────────────────────────────────────────────

  // ── Offline queue flush ────────────────────────────────────────────────────

  const flushOfflineQueue = useCallback(async () => {
    const queue = loadQueue();
    if (queue.length === 0) return;

    const remaining: PendingSetInsert[] = [];

    for (const entry of queue) {
      const { data, error } = await supabase
        .from('sets')
        .insert({
          user_id: entry.userId,
          workout_id: entry.workoutId,
          exercise_id: entry.exerciseId,
          set_number: entry.setNumber,
          weight_lbs: entry.weightLbs,
          reps: entry.reps,
          notes: entry.notes,
        })
        .select()
        .single();

      if (error) {
        remaining.push(entry);
        continue;
      }

      const realSet = data as WorkoutSet;

      // Replace temp ID with real ID in local state
      setActiveWorkoutRaw((prev) => {
        if (!prev) return prev;
        const updatedEntries = { ...prev.entries };
        for (const [exId, exEntry] of Object.entries(updatedEntries)) {
          const idx = exEntry.sets.findIndex((s) => s.id === entry.tempId);
          if (idx !== -1) {
            const updatedSets = [...exEntry.sets];
            updatedSets[idx] = realSet;
            updatedEntries[exId] = { ...exEntry, sets: updatedSets };
            break;
          }
        }
        const next = { ...prev, entries: updatedEntries };
        saveToStorage(next);
        return next;
      });

      dequeue(entry.tempId);
    }

    saveQueue(remaining);

    if (remaining.length === 0) {
      toast.success('Back online — all sets synced.');
    }
  }, []);

  // Listen for reconnect to flush any queued sets
  useEffect(() => {
    const handler = () => flushOfflineQueue();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [flushOfflineQueue]);

  const logSet = useCallback(
    async (exercise: Exercise, weightLbs: number, reps: number, notes?: string) => {
      if (!activeWorkout || !user) throw new Error('No active workout.');

      const existingEntry = activeWorkout.entries[exercise.id];
      const setNumber = (existingEntry?.sets.length ?? 0) + 1;
      const now = new Date().toISOString();

      // Generate a temporary ID for optimistic update
      const tempId = `temp_${crypto.randomUUID()}`;

      const optimisticSet: WorkoutSet = {
        id: tempId,
        user_id: user.id,
        workout_id: activeWorkout.workoutId,
        exercise_id: exercise.id,
        set_number: setNumber,
        weight_lbs: weightLbs,
        reps,
        logged_at: now,
        notes: notes ?? null,
      };

      // Optimistically update local state immediately
      const optimisticWorkout: ActiveWorkout = {
        ...activeWorkout,
        entries: {
          ...activeWorkout.entries,
          [exercise.id]: {
            exercise,
            sets: [...(existingEntry?.sets ?? []), optimisticSet],
            lastLoggedAt: now,
          },
        },
      };
      setActiveWorkout(optimisticWorkout);

      // Write to DB
      const { data, error } = await supabase
        .from('sets')
        .insert({
          user_id: user.id,
          workout_id: activeWorkout.workoutId,
          exercise_id: exercise.id,
          set_number: setNumber,
          weight_lbs: weightLbs,
          reps,
          notes: notes ?? null,
        })
        .select()
        .single();

      if (error) {
        // Network failure — queue for retry when back online
        const pending: PendingSetInsert = {
          tempId,
          userId: user.id,
          workoutId: activeWorkout.workoutId,
          exerciseId: exercise.id,
          setNumber,
          weightLbs,
          reps,
          notes: notes ?? null,
          enqueuedAt: now,
        };
        enqueue(pending);
        toast.warning("You're offline — set saved locally, will sync when reconnected.", {
          id: 'offline-warning',
          duration: 5000,
        });
        return; // local state already updated optimistically
      }

      const realSet = data as WorkoutSet;

      // Replace temp ID with the real DB ID
      setActiveWorkout({
        ...optimisticWorkout,
        entries: {
          ...optimisticWorkout.entries,
          [exercise.id]: {
            ...optimisticWorkout.entries[exercise.id],
            sets: optimisticWorkout.entries[exercise.id].sets.map((s) =>
              s.id === tempId ? realSet : s,
            ),
          },
        },
      });
    },
    [activeWorkout, user, setActiveWorkout],
  );

  const updateSet = useCallback(
    async (setId: string, weightLbs: number, reps: number) => {
      if (!user) throw new Error('Not authenticated.');

      const { error } = await supabase
        .from('sets')
        .update({ weight_lbs: weightLbs, reps })
        .eq('id', setId)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);

      // Update in-memory state
      if (!activeWorkout) return;
      const updatedEntries = { ...activeWorkout.entries };
      for (const [exId, entry] of Object.entries(updatedEntries)) {
        const idx = entry.sets.findIndex((s) => s.id === setId);
        if (idx !== -1) {
          const updatedSets = [...entry.sets];
          updatedSets[idx] = { ...updatedSets[idx], weight_lbs: weightLbs, reps };
          updatedEntries[exId] = { ...entry, sets: updatedSets };
          break;
        }
      }
      setActiveWorkout({ ...activeWorkout, entries: updatedEntries });
    },
    [user, activeWorkout, setActiveWorkout],
  );

  const deleteSet = useCallback(
    async (setId: string) => {
      if (!user) throw new Error('Not authenticated.');

      const { error } = await supabase
        .from('sets')
        .delete()
        .eq('id', setId)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);

      // Remove from in-memory state
      if (!activeWorkout) return;
      const updatedEntries = { ...activeWorkout.entries };
      for (const [exId, entry] of Object.entries(updatedEntries)) {
        const idx = entry.sets.findIndex((s) => s.id === setId);
        if (idx !== -1) {
          const updatedSets = entry.sets.filter((s) => s.id !== setId);
          if (updatedSets.length === 0) {
            // No sets left — remove the exercise entry entirely
            delete updatedEntries[exId];
          } else {
            updatedEntries[exId] = { ...entry, sets: updatedSets };
          }
          break;
        }
      }
      setActiveWorkout({ ...activeWorkout, entries: updatedEntries });
    },
    [user, activeWorkout, setActiveWorkout],
  );

  // ── Rest timer controls ────────────────────────────────────────────────────

  const startRestTimer = useCallback(() => {
    setRestTimer({ status: 'running', elapsedMs: 0, startTime: Date.now() });
  }, []);

  const resumeRestTimer = useCallback(() => {
    setRestTimer((prev) => ({ ...prev, status: 'running', startTime: Date.now() }));
  }, []);

  const resetRestTimer = useCallback(() => {
    setRestTimer({ status: 'idle', elapsedMs: 0, startTime: null });
  }, []);

  // ── Provide ────────────────────────────────────────────────────────────────

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        isWorkoutActive: activeWorkout !== null,
        isSheetOpen,
        setIsSheetOpen,
        exerciseTargets,
        startWorkout,
        finishWorkout,
        discardWorkout,
        logSet,
        updateSet,
        deleteSet,
        restTimer,
        startRestTimer,
        resumeRestTimer,
        resetRestTimer,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkout(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within a WorkoutProvider');
  return ctx;
}
