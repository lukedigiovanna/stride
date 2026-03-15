import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkout } from '@/context/WorkoutContext';

function formatStopwatch(ms: number): string {
  const totalCs = Math.floor(ms / 10); // centiseconds
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const csStr = String(cs).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  if (minutes > 0) {
    return `${minutes}:${sStr}.${csStr}`;
  }
  return `${seconds}.${csStr}`;
}

/**
 * Rest timer strip rendered inside the workout sheet.
 *
 * Idle:    0.00    [▶ Play]
 * Running: 0.00    [⏸ Pause]
 * Paused:  0.00    [▶ Continue]  [↺ Reset]
 */
export default function RestTimer() {
  const { restTimer, startRestTimer, pauseRestTimer, resumeRestTimer, resetRestTimer } =
    useWorkout();

  const { status, elapsedMs, startTime } = restTimer;
  const currentElapsedMs =
    status === 'running' && startTime ? elapsedMs + (Date.now() - startTime) : elapsedMs;

  if (status === 'idle') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface shrink-0">
        <span className="text-xl font-bold tabular-nums text-muted-foreground">
          {formatStopwatch(0)}
        </span>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="border-border flex items-center gap-1.5"
            onClick={startRestTimer}
          >
            <Play className="h-3.5 w-3.5" />
            Start Rest
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface shrink-0">
        <span className="text-xl font-bold tabular-nums text-foreground">
          {formatStopwatch(currentElapsedMs)}
        </span>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="border-border flex items-center gap-1.5"
            onClick={pauseRestTimer}
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        </div>
      </div>
    );
  }

  // paused
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface shrink-0">
      <span className="text-xl font-bold tabular-nums text-foreground">
        {formatStopwatch(currentElapsedMs)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-border flex items-center gap-1.5"
          onClick={resumeRestTimer}
        >
          <Play className="h-3.5 w-3.5" />
          Continue
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground flex items-center gap-1.5"
          onClick={resetRestTimer}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
