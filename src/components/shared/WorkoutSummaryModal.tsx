import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { FinishWorkoutResult, ActiveExerciseEntry } from '@/types';

function formatVolume(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
  return `${Math.round(lbs)} lbs`;
}

interface WorkoutSummaryModalProps {
  open: boolean;
  onDismiss: () => void;
  result: FinishWorkoutResult;
  startedAt: string;
  endedAt: string;
  entries: Record<string, ActiveExerciseEntry>;
}

export default function WorkoutSummaryModal({
  open,
  onDismiss,
  result,
  startedAt,
  endedAt,
  entries,
}: WorkoutSummaryModalProps) {
  const navigate = useNavigate();

  const durationMinutes = differenceInMinutes(parseISO(endedAt), parseISO(startedAt));
  const date = format(parseISO(startedAt), 'EEEE, MMM d');

  const entryList = Object.values(entries);

  const totalSets = entryList.reduce((n, e) => n + e.sets.length, 0);
  const totalVolumeLbs = entryList.reduce((total, entry) => {
    if (entry.exercise.category === 'cardio') return total;
    return total + entry.sets.reduce((s, set) => s + set.weight_lbs * set.reps, 0);
  }, 0);

  function handleDone() {
    onDismiss();
    navigate('/');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDone(); }}>
      <DialogContent className="max-w-sm bg-surface border-border flex flex-col max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-center items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">Workout Complete!</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {date} · {durationMinutes} min
          </p>
        </DialogHeader>

        {/* Stats row */}
        <div className="flex gap-2 mt-2">
          {[
            { label: 'Volume', value: formatVolume(totalVolumeLbs) },
            { label: 'Sets', value: String(totalSets) },
            { label: 'XP Earned', value: `+${result.xpEarned}` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex-1 rounded-xl bg-background border border-border py-2 px-1 flex flex-col items-center gap-0.5"
            >
              <span className="text-base font-bold text-foreground tabular-nums">{value}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
          ))}
        </div>

        {/* Exercise breakdown */}
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Exercises
          </h4>
          <div className="rounded-xl border border-border overflow-hidden">
            {entryList.map((entry, idx) => {
              const isCardio = entry.exercise.category === 'cardio';
              const sets = entry.sets.length;
              const vol = isCardio
                ? null
                : entry.sets.reduce((s, set) => s + set.weight_lbs * set.reps, 0);

              return (
                <div
                  key={entry.exercise.id}
                  className={`flex items-center justify-between px-3 py-2.5 ${
                    idx < entryList.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <span className="text-sm text-foreground">{entry.exercise.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{sets} {sets === 1 ? 'set' : 'sets'}</span>
                    {vol !== null && (
                      <>
                        <span className="text-border">·</span>
                        <span>{formatVolume(vol)}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button className="mt-6 w-full font-bold" onClick={handleDone}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
