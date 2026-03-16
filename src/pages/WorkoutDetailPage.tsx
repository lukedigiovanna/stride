import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ArrowLeft, Check, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useWorkoutDetail } from '@/hooks/useWorkoutDetail';
import { useSets } from '@/hooks/useSets';
import type { WorkoutSet, Exercise } from '@/types';

// ─── Inline set row ───────────────────────────────────────────────────────────

function HistorySetRow({
  set,
  exercise,
  setNumber,
  onUpdated,
  onDeleted,
}: {
  set: WorkoutSet;
  exercise: Exercise;
  setNumber: number;
  onUpdated: (updated: WorkoutSet) => void;
  onDeleted: (setId: string) => void;
}) {
  const { updateSet, deleteSet } = useSets();
  const isCardio = exercise.category === 'cardio';

  const [isEditing, setIsEditing] = useState(false);
  const [weightVal, setWeightVal] = useState(String(set.weight_lbs));
  const [repsVal, setRepsVal] = useState(String(set.reps));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const w = parseFloat(weightVal);
    const r = parseFloat(repsVal);
    if (isNaN(w) || isNaN(r) || w < 0 || r < 0) return;
    setIsSaving(true);
    try {
      const updated = await updateSet(set.id, w, r);
      onUpdated(updated);
      setIsEditing(false);
    } catch {
      toast.error('Failed to update set.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setWeightVal(String(set.weight_lbs));
    setRepsVal(String(set.reps));
    setIsEditing(false);
  }

  async function handleDelete() {
    try {
      await deleteSet(set, exercise);
      onDeleted(set.id);
    } catch {
      toast.error('Failed to delete set.');
    }
  }

  const displayText = isCardio
    ? `${set.weight_lbs} mi  ×  ${set.reps} min`
    : `${set.weight_lbs} lbs  ×  ${set.reps} reps`;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0">
        <span className="text-xs text-muted-foreground w-5 text-center shrink-0 tabular-nums">
          {setNumber}
        </span>
        <input
          type="number"
          inputMode="decimal"
          value={weightVal}
          onChange={(e) => setWeightVal(e.target.value)}
          className="w-20 text-xs bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 py-1 text-center text-foreground focus:outline-none focus:border-foreground"
          placeholder={isCardio ? 'mi' : 'lbs'}
          autoFocus
        />
        <span className="text-xs text-muted-foreground">×</span>
        <input
          type="number"
          inputMode="decimal"
          value={repsVal}
          onChange={(e) => setRepsVal(e.target.value)}
          className="w-16 text-xs bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 py-1 text-center text-foreground focus:outline-none focus:border-foreground"
          placeholder={isCardio ? 'min' : 'reps'}
        />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={handleSave} disabled={isSaving} className="p-1 text-foreground active:opacity-70">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={handleCancel} className="p-1 text-muted-foreground active:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0">
      <span className="text-xs text-muted-foreground w-5 text-center shrink-0 tabular-nums">
        {setNumber}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        className="flex-1 text-left text-sm text-foreground tabular-nums"
      >
        {displayText}
      </button>
      <button
        onClick={handleDelete}
        className="p-1 text-muted-foreground active:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { detail, isLoading, error, updateNotes, deleteWorkout } = useWorkoutDetail(id ?? '');

  // Local mirror of entries for optimistic set edits/deletes
  const [localEntries, setLocalEntries] = useState<typeof detail extends null ? never : NonNullable<typeof detail>['entries'] | null>(null);

  const [notesVal, setNotesVal] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const notesInitialized = useRef(false);

  // Sync local entries from detail on first load
  const entries = localEntries ?? detail?.entries ?? [];

  if (!notesInitialized.current && detail) {
    setNotesVal(detail.workout.notes ?? '');
    notesInitialized.current = true;
  }

  function handleSetUpdated(exerciseId: string, updated: WorkoutSet) {
    setLocalEntries(
      (entries).map((e) =>
        e.exercise.id === exerciseId
          ? { ...e, sets: e.sets.map((s) => (s.id === updated.id ? updated : s)) }
          : e,
      ),
    );
  }

  function handleSetDeleted(exerciseId: string, setId: string) {
    setLocalEntries(
      (entries)
        .map((e) =>
          e.exercise.id === exerciseId
            ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
            : e,
        )
        .filter((e) => e.sets.length > 0),
    );
  }

  async function handleNotesBlur() {
    if (notesVal === null || notesVal === (detail?.workout.notes ?? '')) return;
    try {
      await updateNotes(notesVal);
    } catch {
      toast.error('Failed to save notes.');
    }
  }

  async function handleDeleteWorkout() {
    if (!detail || !user) return;
    setIsDeleting(true);
    try {
      // Subtract workout XP from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', user.id)
        .single();

      const currentXp = (profileData as { total_xp: number } | null)?.total_xp ?? 0;
      const newXp = Math.max(0, currentXp - detail.workout.xp_earned);

      await supabase.from('profiles').update({ total_xp: newXp }).eq('id', user.id);

      await deleteWorkout();
      navigate('/history', { replace: true });
      toast.success('Workout deleted.');
    } catch {
      toast.error('Failed to delete workout.');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm px-8 text-center">
        {error ?? 'Workout not found.'}
      </div>
    );
  }

  const { workout } = detail;
  const durationMinutes = workout.ended_at
    ? differenceInMinutes(parseISO(workout.ended_at), parseISO(workout.started_at))
    : 0;

  const totalVolumeLbs = entries.reduce(
    (total, e) =>
      e.exercise.category === 'cardio'
        ? total
        : total + e.sets.reduce((s, set) => s + set.weight_lbs * set.reps, 0),
    0,
  );

  function formatVolume(lbs: number) {
    if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
    return `${Math.round(lbs)} lbs`;
  }

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
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">
            {format(parseISO(workout.started_at), 'EEEE, MMM d')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(parseISO(workout.started_at), 'yyyy')}
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex gap-3 px-4 py-3 border-b border-border">
        {[
          { label: 'Duration', value: `${durationMinutes} min` },
          { label: 'Volume', value: formatVolume(totalVolumeLbs) },
          { label: 'XP', value: `+${workout.xp_earned}` },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-base font-bold text-foreground tabular-nums">{value}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {/* Exercise sections */}
      <div className="flex-1 px-4 pt-4 space-y-4 pb-6">
        {entries.map((entry) => {
          return (
            <div key={entry.exercise.id}>
              <div className="flex items-baseline justify-between mb-1.5">
                <h3 className="text-sm font-semibold text-foreground">{entry.exercise.name}</h3>
              </div>

              <div className="rounded-sm border border-border overflow-hidden">
                {entry.sets.map((set, idx) => (
                  <HistorySetRow
                    key={set.id}
                    set={set}
                    exercise={entry.exercise}
                    setNumber={idx + 1}
                    onUpdated={(updated) => handleSetUpdated(entry.exercise.id, updated)}
                    onDeleted={(setId) => handleSetDeleted(entry.exercise.id, setId)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Notes */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs text-muted-foreground uppercase tracking-widest">Notes</label>
          <textarea
            value={notesVal ?? ''}
            onChange={(e) => setNotesVal(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add workout notes…"
            rows={3}
            className="w-full bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-foreground transition-colors"
          />
        </div>

        {/* Delete workout */}
        <Button
          variant="destructive"
          className="w-full mt-4"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Workout
        </Button>
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-xs bg-surface border-border">
          <DialogHeader>
            <DialogTitle>Delete workout?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the workout and all its sets.{' '}
            {workout.xp_earned > 0 && `${workout.xp_earned} XP will be deducted from your total.`}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteWorkout} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
