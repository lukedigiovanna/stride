import { useEffect, useState } from 'react';
import { startOfWeek, endOfWeek, parseISO, startOfDay } from 'date-fns';
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

const MS_PER_DAY = 86_400_000;
const BREAK_DAYS = 7; // a gap of this many days or more ends the streak

/**
 * Streak = days elapsed from the start of the current unbroken period to today.
 * A period ends when there is a gap of ≥ 7 days between consecutive workout days,
 * or when the user has not worked out in the last 7 days.
 */
function computeStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;

  const days = [...new Set(
    workouts.map((w) => startOfDay(parseISO(w.started_at)).getTime()),
  )].sort((a, b) => a - b);

  const today = startOfDay(new Date()).getTime();

  // Streak is broken if the last workout was 7+ days ago
  if ((today - days[days.length - 1]) / MS_PER_DAY >= BREAK_DAYS) return 0;

  // Walk forward to find where the current streak segment started
  let streakStart = days[0];
  for (let i = 1; i < days.length; i++) {
    if ((days[i] - days[i - 1]) / MS_PER_DAY >= BREAK_DAYS) {
      streakStart = days[i];
    }
  }

  return Math.round((today - streakStart) / MS_PER_DAY) + 1;
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
    <div>
      <StatRow label="Workouts" value={stats ? String(stats.totalWorkouts) : '—'} />
      <StatRow
        label={`This week (${profile.weight_unit})`}
        value={stats ? (stats.weekVolume !== null ? fmt(stats.weekVolume) : '0') : '—'}
      />
      <StatRow label="Streak (days)" value={stats ? String(stats.streak) : '—'} />
    </div>
  );
}
