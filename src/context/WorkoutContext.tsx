import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { checkLevelUp, createInitialProgress } from '@/lib/levelUp';
import { calcStrengthSetXP, calcCardioSetXP } from '@/lib/xp';
import type {
  ActiveWorkout,
  ActiveExerciseEntry,
  Exercise,
  WorkoutSet,
  UserExerciseProgress,
  FinishWorkoutResult,
  LevelUpResult,
  RestTimerState,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'stride_active_workout';
const DEFAULT_REST_DURATION = 90;

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

  // ── Rest timer ─────────────────────────────────────────────────────────────
  restTimer: RestTimerState;
  startRestTimer: () => void;
  resetRestTimer: () => void;
  stopRestTimer: () => void;
  /** Adds or subtracts seconds from the current countdown. */
  adjustRestTimer: (deltaSeconds: number) => void;
  /** Sets the duration the timer resets to. */
  setRestDuration: (seconds: number) => void;
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
  const [restTimer, setRestTimer] = useState<RestTimerState>({
    isActive: false,
    secondsRemaining: DEFAULT_REST_DURATION,
    durationSeconds: DEFAULT_REST_DURATION,
  });

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Rest timer tick ────────────────────────────────────────────────────────

  useEffect(() => {
    if (restTimer.isActive) {
      timerIntervalRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (prev.secondsRemaining <= 1) {
            // Timer complete
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            // Haptic feedback where supported
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            return { ...prev, isActive: false, secondsRemaining: 0 };
          }
          return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [restTimer.isActive]);

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

    // 4. Run level-up checks for every exercise that has a level system
    const levelUps: LevelUpResult[] = [];

    for (const entry of entries) {
      if (entry.exercise.level_increment_lbs === null) continue;

      // Fetch current progress row (may not exist if this was first time)
      const { data: progData } = await supabase
        .from('user_exercise_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('exercise_id', entry.exercise.id)
        .maybeSingle();

      const progress = progData as UserExerciseProgress | null;
      if (!progress) continue;

      const result = checkLevelUp(entry.sets, progress, entry.exercise);
      if (!result) continue;

      levelUps.push(result);

      // 5. Persist the new level
      await supabase
        .from('user_exercise_progress')
        .update({
          current_level: result.newProgress.current_level,
          level_target_weight_lbs: result.newProgress.level_target_weight_lbs,
          updated_at: result.newProgress.updated_at,
        })
        .eq('id', progress.id);
    }

    // 6. Clear state
    setActiveWorkout(null);
    setIsSheetOpen(false);

    return { xpEarned, levelUps, previousTotalXp, newTotalXp };
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

  const logSet = useCallback(
    async (exercise: Exercise, weightLbs: number, reps: number, notes?: string) => {
      if (!activeWorkout || !user) throw new Error('No active workout.');

      const existingEntry = activeWorkout.entries[exercise.id];
      const setNumber = (existingEntry?.sets.length ?? 0) + 1;

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

      if (error) throw new Error(error.message);
      const newSet = data as WorkoutSet;

      // Ensure a progress row exists for this exercise (first time only)
      if (!existingEntry && exercise.level_increment_lbs !== null) {
        const initialProgress = createInitialProgress(user.id, exercise);
        if (initialProgress) {
          await supabase
            .from('user_exercise_progress')
            .upsert(initialProgress, { onConflict: 'user_id,exercise_id' });
        }
      }

      // Update local state
      const now = new Date().toISOString();
      setActiveWorkout({
        ...activeWorkout,
        entries: {
          ...activeWorkout.entries,
          [exercise.id]: {
            exercise,
            sets: [...(existingEntry?.sets ?? []), newSet],
            lastLoggedAt: now,
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
    setRestTimer((prev) => ({
      ...prev,
      isActive: true,
      secondsRemaining: prev.durationSeconds,
    }));
  }, []);

  const resetRestTimer = useCallback(() => {
    setRestTimer((prev) => ({
      ...prev,
      isActive: true,
      secondsRemaining: prev.durationSeconds,
    }));
  }, []);

  const stopRestTimer = useCallback(() => {
    setRestTimer((prev) => ({
      ...prev,
      isActive: false,
      secondsRemaining: prev.durationSeconds,
    }));
  }, []);

  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    setRestTimer((prev) => ({
      ...prev,
      secondsRemaining: Math.max(1, prev.secondsRemaining + deltaSeconds),
    }));
  }, []);

  const setRestDuration = useCallback((seconds: number) => {
    setRestTimer((prev) => ({
      ...prev,
      durationSeconds: seconds,
      secondsRemaining: prev.isActive ? prev.secondsRemaining : seconds,
    }));
  }, []);

  // ── Provide ────────────────────────────────────────────────────────────────

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        isWorkoutActive: activeWorkout !== null,
        isSheetOpen,
        setIsSheetOpen,
        startWorkout,
        finishWorkout,
        discardWorkout,
        logSet,
        updateSet,
        deleteSet,
        restTimer,
        startRestTimer,
        resetRestTimer,
        stopRestTimer,
        adjustRestTimer,
        setRestDuration,
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
