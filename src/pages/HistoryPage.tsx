import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkouts } from '@/hooks/useWorkouts';
import WorkoutCard, { type WorkoutWithStats } from '@/components/history/WorkoutCard';
import { Button } from '@/components/ui/button';
import type { ExerciseCategory } from '@/types';

export default function HistoryPage() {
  const { workouts, isLoading, hasMore, loadMore } = useWorkouts();
  const [statsMap, setStatsMap] = useState<Record<string, { volumeLbs: number; categories: ExerciseCategory[] }>>({});

  // When workouts change, load sets + exercises for any workout not yet in statsMap
  useEffect(() => {
    const missing = workouts.filter((w) => !statsMap[w.id]);
    if (missing.length === 0) return;

    const ids = missing.map((w) => w.id);

    async function loadStats() {
      const { data: setRows } = await supabase
        .from('sets')
        .select('workout_id, weight_lbs, reps, exercise_id')
        .in('workout_id', ids);

      const sets = (setRows ?? []) as {
        workout_id: string;
        weight_lbs: number;
        reps: number;
        exercise_id: string;
      }[];

      // Get exercise categories
      const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
      const { data: exRows } = await supabase
        .from('exercises')
        .select('id, category')
        .in('id', exerciseIds);

      const categoryMap: Record<string, ExerciseCategory> = {};
      for (const e of (exRows ?? []) as { id: string; category: ExerciseCategory }[]) {
        categoryMap[e.id] = e.category;
      }

      // Build per-workout stats
      const computed: Record<string, { volumeLbs: number; categories: ExerciseCategory[] }> = {};

      for (const id of ids) {
        computed[id] = { volumeLbs: 0, categories: [] };
      }

      const categorySetPerWorkout: Record<string, Set<ExerciseCategory>> = {};

      for (const s of sets) {
        const cat = categoryMap[s.exercise_id];
        if (!computed[s.workout_id]) continue;

        // Volume excludes cardio
        if (cat !== 'cardio') {
          computed[s.workout_id].volumeLbs += s.weight_lbs * s.reps;
        }

        if (cat) {
          if (!categorySetPerWorkout[s.workout_id]) {
            categorySetPerWorkout[s.workout_id] = new Set();
          }
          categorySetPerWorkout[s.workout_id].add(cat);
        }
      }

      for (const id of ids) {
        computed[id].categories = [...(categorySetPerWorkout[id] ?? new Set())];
      }

      setStatsMap((prev) => ({ ...prev, ...computed }));
    }

    loadStats();
  }, [workouts]);

  const enriched: WorkoutWithStats[] = workouts.map((w) => {
    const stats = statsMap[w.id] ?? { volumeLbs: 0, categories: [] };
    const durationMinutes =
      w.ended_at
        ? Math.max(1, Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000))
        : 0;
    return { ...w, durationMinutes, ...stats };
  });

  if (isLoading && workouts.length === 0) {
    return (
      <div className="flex flex-col overflow-y-auto h-full">
        <div className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <h1 className="text-xl font-bold text-foreground">History</h1>
        </div>
        <div className="border-t border-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 border-b border-border animate-pulse bg-surface/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!isLoading && workouts.length === 0) {
    return (
      <div className="flex flex-col overflow-y-auto h-full">
        <div className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <h1 className="text-xl font-bold text-foreground">History</h1>
        </div>
        <div className="flex items-center px-4 h-11 border-b border-border">
          <span className="text-sm text-muted-foreground italic">No completed workouts yet.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      <div className="px-4 pt-5 pb-3 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-foreground">History</h1>
      </div>

      <div className="flex-1">
        {enriched.map((w) => (
          <WorkoutCard key={w.id} workout={w} />
        ))}

        {hasMore && (
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full border-border text-muted-foreground"
              onClick={loadMore}
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
