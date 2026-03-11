import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useAuth } from '@/context/AuthContext';
import type { Workout } from '@/types';

interface WorkoutWithStats extends Workout {
  volumeLbs: number;
  durationMinutes: number;
}

function WorkoutCard({ workout }: { workout: WorkoutWithStats }) {
  const date = parseISO(workout.started_at);
  const vol =
    workout.volumeLbs >= 1000
      ? `${(workout.volumeLbs / 1000).toFixed(1)}k lbs`
      : `${Math.round(workout.volumeLbs)} lbs`;

  return (
    <Link
      to={`/history/${workout.id}`}
      className="flex items-center gap-3 rounded-xl bg-surface border border-border p-3 active:bg-surface/80 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {format(date, 'EEEE, MMM d')}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {workout.durationMinutes} min · {vol} · +{workout.xp_earned} XP
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

export default function RecentActivity() {
  const { user } = useAuth();
  const { workouts, isLoading } = useWorkouts();
  const [enriched, setEnriched] = useState<WorkoutWithStats[]>([]);

  const recent = workouts.slice(0, 3);

  useEffect(() => {
    if (!user || recent.length === 0) {
      setEnriched([]);
      return;
    }

    async function loadVolumes() {
      const ids = recent.map((w) => w.id);

      const { data: setRows } = await supabase
        .from('sets')
        .select('workout_id, weight_lbs, reps, exercise_id')
        .in('workout_id', ids);

      const { data: exerciseRows } = await supabase
        .from('exercises')
        .select('id, category')
        .in('id', [...new Set((setRows ?? []).map((s: { exercise_id: string }) => s.exercise_id))]);

      const cardioIds = new Set(
        (exerciseRows ?? [])
          .filter((e: { category: string }) => e.category === 'cardio')
          .map((e: { id: string }) => e.id),
      );

      // Sum volume per workout
      const volMap: Record<string, number> = {};
      for (const s of (setRows ?? []) as { workout_id: string; weight_lbs: number; reps: number; exercise_id: string }[]) {
        if (!cardioIds.has(s.exercise_id)) {
          volMap[s.workout_id] = (volMap[s.workout_id] ?? 0) + s.weight_lbs * s.reps;
        }
      }

      setEnriched(
        recent.map((w) => ({
          ...w,
          volumeLbs: volMap[w.id] ?? 0,
          durationMinutes: w.ended_at
            ? differenceInMinutes(parseISO(w.ended_at), parseISO(w.started_at))
            : 0,
        })),
      );
    }

    loadVolumes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workouts]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (enriched.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No completed workouts yet. Start your first session!
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {enriched.map((w) => (
        <WorkoutCard key={w.id} workout={w} />
      ))}

      {workouts.length > 3 && (
        <Link
          to="/history"
          className="flex items-center justify-center gap-1 text-sm text-primary font-medium py-1"
        >
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
