import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useExercises } from '@/hooks/useExercises';
import ExerciseList from '@/components/exercises/ExerciseList';
import CreateExerciseModal from '@/components/exercises/CreateExerciseModal';
import type { WorkoutSet } from '@/types';

/** Compute mode weight from an array of sets. Ties broken by the higher weight. */
function modeWeight(sets: WorkoutSet[]): number {
  const counts: Record<number, number> = {};
  for (const s of sets) {
    counts[s.weight_lbs] = (counts[s.weight_lbs] ?? 0) + 1;
  }
  let best = -Infinity;
  let bestCount = 0;
  for (const [w, c] of Object.entries(counts)) {
    const weight = Number(w);
    if (c > bestCount || (c === bestCount && weight > best)) {
      best = weight;
      bestCount = c;
    }
  }
  return best;
}

export default function ExercisesPage() {
  const { user } = useAuth();
  const { exercises, isLoading } = useExercises();
  const [weightMap, setWeightMap] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function loadWorkingWeights() {
      // 1. For each exercise, find the most recent completed workout date
      const { data: latestRows } = await supabase
        .from('sets')
        .select('exercise_id, workout_id, logged_at')
        .eq('user_id', user!.id)
        .order('logged_at', { ascending: false });

      if (!latestRows || latestRows.length === 0) return;

      // Find the most recent workout_id per exercise_id
      const latestWorkoutPerExercise: Record<string, string> = {};
      for (const row of latestRows as { exercise_id: string; workout_id: string; logged_at: string }[]) {
        if (!latestWorkoutPerExercise[row.exercise_id]) {
          latestWorkoutPerExercise[row.exercise_id] = row.workout_id;
        }
      }

      // 2. Only consider sets from completed workouts
      const workoutIds = [...new Set(Object.values(latestWorkoutPerExercise))];
      const { data: completedWorkouts } = await supabase
        .from('workouts')
        .select('id')
        .in('id', workoutIds)
        .not('ended_at', 'is', null);

      const completedSet = new Set((completedWorkouts ?? []).map((w: { id: string }) => w.id));

      // Filter to only completed workouts
      const validLatest: Record<string, string> = {};
      for (const [exId, wId] of Object.entries(latestWorkoutPerExercise)) {
        if (completedSet.has(wId)) validLatest[exId] = wId;
      }

      if (Object.keys(validLatest).length === 0) return;

      // 3. Fetch all sets for those (exercise, workout) pairs
      const { data: allSets } = await supabase
        .from('sets')
        .select('exercise_id, workout_id, weight_lbs, reps')
        .eq('user_id', user!.id)
        .in('workout_id', [...new Set(Object.values(validLatest))]);

      if (!allSets) return;

      // 4. Group sets by exercise_id, filtered to the correct workout
      const setsByExercise: Record<string, WorkoutSet[]> = {};
      for (const s of allSets as WorkoutSet[]) {
        if (validLatest[s.exercise_id] !== s.workout_id) continue;
        if (!setsByExercise[s.exercise_id]) setsByExercise[s.exercise_id] = [];
        setsByExercise[s.exercise_id].push(s);
      }

      // 5. Compute mode weight per exercise
      const map: Record<string, number> = {};
      for (const [exId, sets] of Object.entries(setsByExercise)) {
        map[exId] = modeWeight(sets);
      }
      setWeightMap(map);
    }

    loadWorkingWeights();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading exercises…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <ExerciseList
        exercises={exercises}
        weightMap={weightMap}
        currentUserId={user?.id ?? ''}
      />

      {/* FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-sm bg-foreground px-4 py-3 text-sm font-bold text-background active:opacity-80 transition-opacity"
      >
        <Plus className="h-4 w-4" />
        New Exercise
      </button>

      <CreateExerciseModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
