import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO, subMonths } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Exercise, WorkoutSet } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetWithWorkout extends WorkoutSet {
  workout_started_at: string;
}

interface Session {
  date: string;             // YYYY-MM-DD
  startedAt: string;        // ISO, for sorting
  sets: SetWithWorkout[];
  volumeLbs: number;
  maxWeightLbs: number;
  totalDistance: number;    // cardio only
  totalDuration: number;    // cardio only (minutes)
}

// ─── Time range filter ────────────────────────────────────────────────────────

const RANGES = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: 'All', months: null },
] as const;

type RangeLabel = (typeof RANGES)[number]['label'];

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded bg-surface border border-border px-2 py-1 text-xs text-foreground shadow">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{payload[0].value.toLocaleString()}</p>
    </div>
  );
}

// ─── Chart section ────────────────────────────────────────────────────────────

function ChartSection({ sessions, isCardio }: { sessions: Session[]; isCardio: boolean }) {
  const [range, setRange] = useState<RangeLabel>('3M');

  const filtered = useMemo(() => {
    const selected = RANGES.find((r) => r.label === range)!;
    if (selected.months === null) return sessions;
    const cutoff = subMonths(new Date(), selected.months);
    return sessions.filter((s) => parseISO(s.startedAt) >= cutoff);
  }, [sessions, range]);

  const chartData = filtered.map((s) => ({
    date: format(parseISO(s.startedAt), 'MMM d'),
    volume: Math.round(s.volumeLbs),
    maxWeight: Math.round(s.maxWeightLbs),
    distance: Math.round(s.totalDistance * 100) / 100,
    duration: Math.round(s.totalDuration),
  }));

  const axisStyle = { fontSize: 10, fill: 'var(--muted-foreground)' };
  const amber = 'var(--primary)';

  return (
    <div className="space-y-5 px-4">
      {/* Range toggle */}
      <div className="flex gap-1.5">
        {RANGES.map(({ label }) => (
          <button
            key={label}
            onClick={() => setRange(label)}
            className={`rounded-sm px-3 py-1 text-xs font-bold border transition-colors ${
              range === label
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent border-border text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No data in this range.</p>
      ) : isCardio ? (
        <>
          {/* Distance */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Distance (mi)</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="distance" stroke={amber} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Duration */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Duration (min)</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="duration" stroke={amber} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <>
          {/* Volume */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Volume (lbs)</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="volume" fill={amber} radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Max weight */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Max weight (lbs)</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="maxWeight" stroke={amber} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Set history ──────────────────────────────────────────────────────────────

function SetHistory({ sessions, isCardio }: { sessions: Session[]; isCardio: boolean }) {
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-4 px-4 pb-6">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        History
      </h3>
      {[...sessions].reverse().map((session) => (
        <div key={session.date} className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {format(parseISO(session.startedAt), 'EEEE, MMM d')}
          </p>
          <div className="rounded-sm border border-border overflow-hidden">
            {session.sets.map((set, idx) => (
              <div
                key={set.id}
                className={`flex items-center px-3 py-2 text-sm ${
                  idx < session.sets.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span className="text-muted-foreground w-6 tabular-nums text-xs">{idx + 1}</span>
                <span className="text-foreground tabular-nums">
                  {isCardio
                    ? `${set.weight_lbs} mi  ×  ${set.reps} min`
                    : `${set.weight_lbs} lbs  ×  ${set.reps} reps`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;

    async function load() {
      setIsLoading(true);

      // 1. Exercise details
      const { data: exData } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', id)
        .single();

      if (!exData) { setIsLoading(false); return; }
      const ex = exData as Exercise;
      setExercise(ex);

      // 2. All sets for this exercise
      const { data: setRows } = await supabase
        .from('sets')
        .select('*')
        .eq('user_id', user!.id)
        .eq('exercise_id', id)
        .order('logged_at', { ascending: true });

      const sets = (setRows ?? []) as WorkoutSet[];

      if (sets.length === 0) { setIsLoading(false); return; }

      // 4. Workouts for those sets (to get started_at for grouping)
      const workoutIds = [...new Set(sets.map((s) => s.workout_id))];
      const { data: workoutRows } = await supabase
        .from('workouts')
        .select('id, started_at')
        .in('id', workoutIds)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: true });

      const workoutMap: Record<string, string> = {};
      for (const w of (workoutRows ?? []) as { id: string; started_at: string }[]) {
        workoutMap[w.id] = w.started_at;
      }

      // 5. Build sessions
      const sessionMap: Record<string, Session> = {};
      for (const set of sets) {
        const wStartedAt = workoutMap[set.workout_id];
        if (!wStartedAt) continue;
        const date = wStartedAt.slice(0, 10);
        if (!sessionMap[date]) {
          sessionMap[date] = {
            date,
            startedAt: wStartedAt,
            sets: [],
            volumeLbs: 0,
            maxWeightLbs: 0,
            totalDistance: 0,
            totalDuration: 0,
          };
        }
        const enriched: SetWithWorkout = { ...set, workout_started_at: wStartedAt };
        sessionMap[date].sets.push(enriched);
        if (ex.category === 'cardio') {
          sessionMap[date].totalDistance += set.weight_lbs;
          sessionMap[date].totalDuration += set.reps;
        } else {
          sessionMap[date].volumeLbs += set.weight_lbs * set.reps;
          sessionMap[date].maxWeightLbs = Math.max(sessionMap[date].maxWeightLbs, set.weight_lbs);
        }
      }

      setSessions(Object.values(sessionMap).sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
      setIsLoading(false);
    }

    load();
  }, [user, id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Exercise not found.
      </div>
    );
  }

  const isCardio = exercise.category === 'cardio';

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-border shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-muted-foreground active:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground leading-tight truncate">
            {exercise.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground capitalize">
              {exercise.category}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground capitalize">
              {exercise.equipment_type}
            </Badge>
          </div>
        </div>
      </div>

      {/* Charts */}
      {sessions.length > 0 && (
        <div className="py-4 border-t border-border">
          <ChartSection sessions={sessions} isCardio={isCardio} />
        </div>
      )}

      {/* Set history */}
      {sessions.length > 0 ? (
        <div className="border-t border-border pt-4">
          <SetHistory sessions={sessions} isCardio={isCardio} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12 px-4">
          No sets logged for this exercise yet.
        </p>
      )}
    </div>
  );
}
