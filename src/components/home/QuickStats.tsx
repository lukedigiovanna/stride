import { useEffect, useState } from 'react';
import { startOfWeek, endOfWeek, parseISO, startOfDay, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { fromLbs } from '@/lib/units';
import type { Profile, Workout } from '@/types';

interface QuickStatsProps {
  profile: Profile;
}

interface Stats {
  totalWorkouts: number;
  weekVolume: number | null;   // in profile's unit
  streak: number;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface border border-border p-3 flex flex-col items-center gap-0.5">
      <span className="text-xl font-extrabold text-foreground tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide text-center">{label}</span>
    </div>
  );
}

/** Compute streak: consecutive calendar days ending today with ≥ 1 completed workout. */
function computeStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;

  // Collect unique dates (YYYY-MM-DD) of completed workouts
  const daySet = new Set(
    workouts.map((w) => startOfDay(parseISO(w.started_at)).toISOString()),
  );

  let streak = 0;
  let cursor = startOfDay(new Date());

  while (daySet.has(cursor.toISOString())) {
    streak++;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

export default function QuickStats({ profile }: QuickStatsProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    async function load() {
      const now = new Date();
      // Mon–Sun week containing today
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // 1. All completed workouts (needed for count + streak)
      const { data: workoutRows } = await supabase
        .from('workouts')
        .select('id, started_at')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false });

      const workouts = (workoutRows ?? []) as Workout[];

      // 2. Sets from this week's completed workouts (for volume)
      const thisWeekWorkoutIds = workouts
        .filter((w) => {
          const d = parseISO(w.started_at);
          return d >= weekStart && d <= weekEnd;
        })
        .map((w) => w.id);

      let weekVolumeLbs: number | null = null;

      if (thisWeekWorkoutIds.length > 0) {
        const { data: setRows } = await supabase
          .from('sets')
          .select('weight_lbs, reps, exercise_id')
          .in('workout_id', thisWeekWorkoutIds);

        // Need exercise categories to exclude cardio — but sets don't have category.
        // Join via exercises table. We fetch exercise ids first then filter.
        const { data: exerciseRows } = await supabase
          .from('exercises')
          .select('id, category')
          .in('id', [...new Set((setRows ?? []).map((s: { exercise_id: string }) => s.exercise_id))]);

        const cardioIds = new Set(
          (exerciseRows ?? [])
            .filter((e: { category: string }) => e.category === 'cardio')
            .map((e: { id: string }) => e.id),
        );

        weekVolumeLbs = (setRows ?? []).reduce(
          (sum: number, s: { weight_lbs: number; reps: number; exercise_id: string }) =>
            cardioIds.has(s.exercise_id) ? sum : sum + s.weight_lbs * s.reps,
          0,
        );
      }

      setStats({
        totalWorkouts: workouts.length,
        weekVolume:
          weekVolumeLbs !== null
            ? fromLbs(weekVolumeLbs, profile.weight_unit)
            : null,
        streak: computeStreak(workouts),
      });
    }

    load();
  }, [user, profile.weight_unit]);

  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

  return (
    <div className="flex gap-2">
      <StatTile
        label="Workouts"
        value={stats ? String(stats.totalWorkouts) : '—'}
      />
      <StatTile
        label={`This week (${profile.weight_unit})`}
        value={
          stats
            ? stats.weekVolume !== null
              ? fmt(stats.weekVolume)
              : '0'
            : '—'
        }
      />
      <StatTile
        label="Day streak"
        value={stats ? String(stats.streak) : '—'}
      />
    </div>
  );
}
