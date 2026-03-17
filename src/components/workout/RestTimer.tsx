import { Play, RotateCcw } from 'lucide-react';
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
 * Idle:    0.00    [▶ Start Rest]
 * Running: 0.00    [↺ Reset]
 */
export default function RestTimer() {
  const { restTimer, startRestTimer, resetRestTimer } = useWorkout();

  const { status, elapsedMs, startTime } = restTimer;
  const currentElapsedMs =
    status === 'running' && startTime ? elapsedMs + (Date.now() - startTime) : 0;

  return (
    <div className="flex items-center px-4 py-2 border-b border-border bg-surface">
      <span className={`text-2xl font-bold tabular-nums ${status === 'idle' ? "text-muted-foreground" : "text-foreground"}`}>
        {formatStopwatch(currentElapsedMs)}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto border-border"
        onClick={status === 'idle' ? startRestTimer : resetRestTimer}
      >
        {
          status === 'idle' ?
          <>
            <Play className="h-3.5 w-3.5" />
            Start
          </>
          :
          <>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </> 
        }
      </Button>
    </div>
  );
}
