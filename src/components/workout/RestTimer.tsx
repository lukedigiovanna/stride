import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkout } from '@/context/WorkoutContext';
import { cn } from '@/lib/utils';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Rest timer strip rendered inside the workout sheet.
 *
 * Idle:  [ Start Rest ]  [ 90s ▼ ▲ ]
 * Active: 01:27  [ +30s ]  [ Reset ]  [ Stop ]
 *
 * On timer completion the display briefly flashes amber.
 */
export default function RestTimer() {
  const { restTimer, startRestTimer, resetRestTimer, stopRestTimer, adjustRestTimer, setRestDuration } =
    useWorkout();

  const { isActive, secondsRemaining, durationSeconds } = restTimer;

  // Flash state — set for 1.5 s when timer naturally hits 0
  const [justDone, setJustDone] = useState(false);

  useEffect(() => {
    if (!isActive && secondsRemaining === 0) {
      const t1 = setTimeout(() => setJustDone(true), 0);
      const t2 = setTimeout(() => setJustDone(false), 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isActive, secondsRemaining]);

  // ── Active state ────────────────────────────────────────────────────────────
  if (isActive) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface shrink-0">
        {/* Countdown */}
        <span
          className={cn(
            'text-xl font-bold tabular-nums transition-colors',
            secondsRemaining <= 10 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatCountdown(secondsRemaining)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-border"
            onClick={() => adjustRestTimer(30)}
          >
            +30s
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-border"
            onClick={resetRestTimer}
          >
            Reset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={stopRestTimer}
          >
            Stop
          </Button>
        </div>
      </div>
    );
  }

  // ── Idle state ──────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 border-b border-border shrink-0 transition-colors',
        justDone && 'bg-primary/20',
      )}
    >
      <Button
        size="sm"
        variant="outline"
        className="border-border text-sm"
        onClick={startRestTimer}
      >
        Start Rest
      </Button>

      {/* Duration stepper */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm tabular-nums text-foreground font-medium w-12 text-center">
          {durationSeconds}s
        </span>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setRestDuration(Math.min(600, durationSeconds + 15))}
            className="p-0.5 text-muted-foreground active:text-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setRestDuration(Math.max(15, durationSeconds - 15))}
            className="p-0.5 text-muted-foreground active:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
