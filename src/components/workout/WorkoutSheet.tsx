import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWorkout } from '@/context/WorkoutContext';
import { useAuth } from '@/context/AuthContext';
import { useExercises } from '@/hooks/useExercises';
import { useBodyweightLogs } from '@/hooks/useBodyweightLogs';
import ExerciseAccordion from './ExerciseAccordion';
import AddExerciseModal from './AddExerciseModal';
import RestTimer from './RestTimer';
import WorkoutSummaryModal from '@/components/shared/WorkoutSummaryModal';
import { getLevelFromXP } from '@/lib/xp';
import { levelUpBridge } from '@/lib/levelUpBridge';
import type { Exercise, ActiveExerciseEntry, FinishWorkoutResult } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(startedAt: string): string {
  const total = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calcVolumeLbs(entries: Record<string, ActiveExerciseEntry>): number {
  return Object.values(entries).reduce((total, entry) => {
    if (entry.exercise.category === 'cardio') return total;
    return total + entry.sets.reduce((sum, s) => sum + s.weight_lbs * s.reps, 0);
  }, 0);
}

function formatVolume(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
  return `${Math.round(lbs)} lbs`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkoutSheet() {
  const { activeWorkout, isSheetOpen, setIsSheetOpen, finishWorkout, discardWorkout } = useWorkout();
  const { profile } = useAuth();
  const { exercises } = useExercises();
  const { sevenDayAvgLbs } = useBodyweightLogs();

  const [tick, setTick] = useState(0);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [pendingExercise, setPendingExercise] = useState<Exercise | null>(null);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Captured snapshot for the summary modal (activeWorkout is cleared on finish)
  const [summaryResult, setSummaryResult] = useState<FinishWorkoutResult | null>(null);
  const [summaryEntries, setSummaryEntries] = useState<Record<string, ActiveExerciseEntry>>({});
  const [summaryStartedAt, setSummaryStartedAt] = useState('');
  const [summaryEndedAt, setSummaryEndedAt] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Re-render every second for the elapsed timer display
  useEffect(() => {
    if (!activeWorkout || !isSheetOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeWorkout, isSheetOpen]);

  void tick; // intentional re-render trigger

  const handlePendingHandled = useCallback(() => setPendingExercise(null), []);

  async function handleFinish() {
    if (!activeWorkout) return;
    setIsFinishing(true);

    // Capture snapshot before finishWorkout clears state
    const entriesSnapshot = { ...activeWorkout.entries };
    const startedAtSnapshot = activeWorkout.startedAt;
    const endedAtSnapshot = new Date().toISOString();

    try {
      const result = await finishWorkout();
      setFinishDialogOpen(false);

      // Fire one toast per exercise level-up
      for (const lu of result.levelUps) {
        toast(`🏋️ ${lu.exercise.name} → Level ${lu.newLevel}`, {
          duration: 4000,
          style: {
            background: 'var(--surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--primary)',
          },
        });
      }

      // Store snapshot + result for summary modal
      setSummaryResult(result);
      setSummaryEntries(entriesSnapshot);
      setSummaryStartedAt(startedAtSnapshot);
      setSummaryEndedAt(endedAtSnapshot);

      // If global level increased, let the overlay show first
      const globalLevelBefore = getLevelFromXP(result.previousTotalXp);
      const globalLevelAfter = getLevelFromXP(result.newTotalXp);
      if (globalLevelAfter > globalLevelBefore) {
        levelUpBridge.register(() => setSummaryOpen(true));
      } else {
        setSummaryOpen(true);
      }
    } catch {
      toast.error('Failed to finish workout.');
    } finally {
      setIsFinishing(false);
    }
  }

  async function handleDiscard() {
    setIsDiscarding(true);
    try {
      await discardWorkout();
      setDiscardDialogOpen(false);
    } catch {
      toast.error('Failed to discard workout.');
    } finally {
      setIsDiscarding(false);
    }
  }

  if (!activeWorkout) {
    // Still render summary modal even after workout is cleared
    return summaryResult ? (
      <WorkoutSummaryModal
        open={summaryOpen}
        onDismiss={() => { setSummaryOpen(false); setSummaryResult(null); }}
        result={summaryResult}
        startedAt={summaryStartedAt}
        endedAt={summaryEndedAt}
        entries={summaryEntries}
      />
    ) : null;
  }

  const totalSets = Object.values(activeWorkout.entries).reduce((n, e) => n + e.sets.length, 0);
  const exerciseCount = Object.keys(activeWorkout.entries).length;
  const volume = formatVolume(calcVolumeLbs(activeWorkout.entries));
  const elapsed = formatElapsed(activeWorkout.startedAt);

  return (
    <>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="bottom"
          className="p-0 bg-surface border-border rounded-t-2xl flex flex-col"
          style={{ height: '87dvh' }}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Sticky header */}
          <div className="px-4 pb-3 border-b border-border shrink-0 space-y-1">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsSheetOpen(false)}
                className="p-1 -ml-1 text-muted-foreground active:text-foreground"
              >
                <ChevronDown className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 text-sm tabular-nums">
                <span className="font-semibold text-foreground">{elapsed}</span>
                <span className="text-border">·</span>
                <span className="text-muted-foreground">{volume}</span>
              </div>

              <Button
                size="sm"
                onClick={() => setFinishDialogOpen(true)}
                className="text-xs font-bold"
              >
                Finish
              </Button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setDiscardDialogOpen(true)}
                className="text-xs text-destructive/70 active:text-destructive"
              >
                Discard workout
              </button>
            </div>
          </div>

          {/* Rest Timer */}
          <RestTimer />

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <ExerciseAccordion
              exercises={exercises}
              entries={activeWorkout.entries}
              sevenDayAvgLbs={sevenDayAvgLbs}
              weightUnit={profile?.weight_unit ?? 'lbs'}
              pendingExercise={pendingExercise}
              onPendingHandled={handlePendingHandled}
            />

            <button
              onClick={() => setAddExerciseOpen(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground active:bg-border/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Exercise
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Exercise Modal */}
      <AddExerciseModal
        open={addExerciseOpen}
        onOpenChange={setAddExerciseOpen}
        exercises={exercises}
        onSelect={(exercise) => {
          setAddExerciseOpen(false);
          setPendingExercise(exercise);
          setIsSheetOpen(true);
        }}
      />

      {/* Finish confirmation */}
      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent className="max-w-xs bg-surface border-border">
          <DialogHeader>
            <DialogTitle>Finish workout?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You've logged {totalSets} {totalSets === 1 ? 'set' : 'sets'} across{' '}
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setFinishDialogOpen(false)} disabled={isFinishing}>
              Cancel
            </Button>
            <Button onClick={handleFinish} disabled={isFinishing}>
              {isFinishing ? 'Saving…' : 'Finish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <DialogContent className="max-w-xs bg-surface border-border">
          <DialogHeader>
            <DialogTitle>Discard workout?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            All {totalSets} {totalSets === 1 ? 'set' : 'sets'} will be permanently deleted.
            This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDiscardDialogOpen(false)} disabled={isDiscarding}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={isDiscarding}>
              {isDiscarding ? 'Discarding…' : 'Discard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
