import { useEffect, useState } from 'react';
import { ChevronUp, Dumbbell } from 'lucide-react';
import { useWorkout } from '@/context/WorkoutContext';
import type { ActiveWorkout } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats milliseconds of elapsed time as M:SS or H:MM:SS */
function formatElapsed(startedAt: string): string {
  const totalSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
  );
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Total volume in lbs for the active workout.
 * Cardio entries (category === 'cardio') are excluded since their
 * weight_lbs field represents distance, not load.
 */
function calcVolume(workout: ActiveWorkout): number {
  return Object.values(workout.entries).reduce((total, entry) => {
    if (entry.exercise.category === 'cardio') return total;
    return (
      total +
      entry.sets.reduce((sum, s) => sum + s.weight_lbs * s.reps, 0)
    );
  }, 0);
}

function formatVolume(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
  return `${Math.round(lbs)} lbs`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Persistent strip shown above BottomNav whenever a workout is active.
 * Displays live elapsed time and running volume. Tapping opens the workout sheet.
 *
 * The full workout sheet (Step 6) is wired via WorkoutContext.setIsSheetOpen.
 */
export default function WorkoutBar() {
  const { activeWorkout, setIsSheetOpen } = useWorkout();
  const [, setTick] = useState(0);

  // Re-render every second to update elapsed time
  useEffect(() => {
    if (!activeWorkout) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeWorkout]);

  if (!activeWorkout) return null;

  const elapsed = formatElapsed(activeWorkout.startedAt);
  const volume = formatVolume(calcVolume(activeWorkout));
  const setCount = Object.values(activeWorkout.entries).reduce(
    (n, e) => n + e.sets.length,
    0,
  );

  return (
    <button
      onClick={() => setIsSheetOpen(true)}
      className="fixed left-0 right-0 z-40 flex items-center gap-3 px-4 bg-primary/10 border-t border-primary/30 backdrop-blur-sm cursor-pointer active:bg-primary/20 transition-colors"
      style={{
        bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        height: '52px',
      }}
    >
      {/* Icon */}
      <Dumbbell className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />

      {/* Label */}
      <span className="text-sm font-semibold text-primary">Workout in progress</span>

      {/* Stats */}
      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums font-medium text-foreground">{elapsed}</span>
        <span className="text-border">·</span>
        <span className="tabular-nums">{volume}</span>
        <span className="text-border">·</span>
        <span>{setCount} {setCount === 1 ? 'set' : 'sets'}</span>
      </div>

      {/* Expand chevron */}
      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
    </button>
  );
}
