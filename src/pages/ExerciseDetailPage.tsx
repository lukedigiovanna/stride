import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO, subMonths } from 'date-fns';
import { ArrowLeft, Pencil } from 'lucide-react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useExerciseTargets } from '@/hooks/useExerciseTargets';
import {
  formatSetRange,
  formatRepRange,
  formatRestRange,
} from '@/lib/targets';
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

// ─── Targets section ──────────────────────────────────────────────────────────

function ExerciseTargetsSection({ exerciseId }: { exerciseId: string }) {
  const { target, isLoading, upsertTarget, clearTarget } = useExerciseTargets(exerciseId);
  const [editing, setEditing] = useState(false);

  // Local form state (strings so inputs stay controlled)
  const [setsMin, setSetsMin] = useState('');
  const [setsMax, setSetsMax] = useState('');
  const [repsMin, setRepsMin] = useState('');
  const [repsMax, setRepsMax] = useState('');
  const [restMin, setRestMin] = useState('');
  const [restMax, setRestMax] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openEdit() {
    setSetsMin(target?.target_sets_min?.toString() ?? '');
    setSetsMax(target?.target_sets_max?.toString() ?? '');
    setRepsMin(target?.target_reps_min?.toString() ?? '');
    setRepsMax(target?.target_reps_max?.toString() ?? '');
    setRestMin(target?.target_rest_seconds_min?.toString() ?? '');
    setRestMax(target?.target_rest_seconds_max?.toString() ?? '');
    setValidationError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setValidationError(null);
  }

  function parseField(val: string): number | null {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }

  async function handleSave() {
    const sm = parseField(setsMin);
    const sx = parseField(setsMax);
    const rm = parseField(repsMin);
    const rx = parseField(repsMax);
    const tm = parseField(restMin);
    const tx = parseField(restMax);

    // Validation
    if ((sm !== null && sm <= 0) || (sx !== null && sx <= 0)) {
      setValidationError('Set counts must be positive.');
      return;
    }
    if ((rm !== null && rm <= 0) || (rx !== null && rx <= 0)) {
      setValidationError('Rep counts must be positive.');
      return;
    }
    if ((tm !== null && tm <= 0) || (tx !== null && tx <= 0)) {
      setValidationError('Rest values must be positive.');
      return;
    }
    if (sm !== null && sx !== null && sm > sx) {
      setValidationError('Min sets cannot exceed max sets.');
      return;
    }
    if (rm !== null && rx !== null && rm > rx) {
      setValidationError('Min reps cannot exceed max reps.');
      return;
    }
    if (tm !== null && tx !== null && tm > tx) {
      setValidationError('Min rest cannot exceed max rest.');
      return;
    }

    const allNull = sm === null && sx === null && rm === null && rx === null && tm === null && tx === null;

    setIsSaving(true);
    if (allNull) {
      await clearTarget();
    } else {
      await upsertTarget({
        target_sets_min: sm,
        target_sets_max: sx,
        target_reps_min: rm,
        target_reps_max: rx,
        target_rest_seconds_min: tm,
        target_rest_seconds_max: tx,
      });
    }
    setIsSaving(false);
    setEditing(false);
  }

  const hasTarget = target !== null && (
    target.target_sets_min !== null || target.target_sets_max !== null ||
    target.target_reps_min !== null || target.target_reps_max !== null ||
    target.target_rest_seconds_min !== null || target.target_rest_seconds_max !== null
  );

  if (isLoading) return null;

  return (
    <div className="px-4 pb-6 border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Your Targets
        </h3>
        {!editing && (
          hasTarget ? (
            <button
              onClick={openEdit}
              className="p-1 text-muted-foreground active:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={openEdit}
              className="text-xs text-amber-500 font-medium"
            >
              Set targets
            </button>
          )
        )}
      </div>

      {!editing && !hasTarget && (
        <p className="text-sm text-muted-foreground italic">No targets set.</p>
      )}

      {!editing && hasTarget && (
        <div className="space-y-1">
          {(target.target_sets_min !== null || target.target_sets_max !== null) && (
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground w-10">Sets</span>
              <span className="text-foreground">
                {formatSetRange(target.target_sets_min, target.target_sets_max)}
              </span>
            </div>
          )}
          {(target.target_reps_min !== null || target.target_reps_max !== null) && (
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground w-10">Reps</span>
              <span className="text-foreground">
                {formatRepRange(target.target_reps_min, target.target_reps_max)}
              </span>
            </div>
          )}
          {(target.target_rest_seconds_min !== null || target.target_rest_seconds_max !== null) && (
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground w-10">Rest</span>
              <span className="text-foreground">
                {formatRestRange(target.target_rest_seconds_min, target.target_rest_seconds_max)}
              </span>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          {/* Sets */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Sets</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                placeholder="Min"
                value={setsMin}
                onChange={(e) => setSetsMin(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-muted-foreground text-xs shrink-0">–</span>
              <input
                type="number"
                min={1}
                placeholder="Max"
                value={setsMax}
                onChange={(e) => setSetsMax(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Reps */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Reps</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                placeholder="Min"
                value={repsMin}
                onChange={(e) => setRepsMin(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-muted-foreground text-xs shrink-0">–</span>
              <input
                type="number"
                min={1}
                placeholder="Max"
                value={repsMax}
                onChange={(e) => setRepsMax(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Rest */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Rest <span className="text-muted-foreground/60">(seconds)</span></p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                placeholder="Min"
                value={restMin}
                onChange={(e) => setRestMin(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-muted-foreground text-xs shrink-0">–</span>
              <input
                type="number"
                min={1}
                placeholder="Max"
                value={restMax}
                onChange={(e) => setRestMax(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
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

      {/* Targets */}
      {!isCardio && <ExerciseTargetsSection exerciseId={exercise.id} />}

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
        <div className="flex items-center px-4 h-11 border-b border-border mt-4">
          <span className="text-sm text-muted-foreground italic">No sets logged yet.</span>
        </div>
      )}
    </div>
  );
}
