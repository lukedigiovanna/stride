import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Workout, ExerciseCategory } from '@/types';

export interface WorkoutWithStats extends Workout {
  durationMinutes: number;
  volumeLbs: number;
  /** Unique categories present in this workout's sets. */
  categories: ExerciseCategory[];
}

function formatVolume(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
  return `${Math.round(lbs)} lbs`;
}

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  legs: 'Legs', push: 'Push', pull: 'Pull',
  core: 'Core', cardio: 'Cardio', misc: 'Misc',
};

export default function WorkoutCard({ workout }: { workout: WorkoutWithStats }) {
  const navigate = useNavigate();
  const date = parseISO(workout.started_at);

  return (
    <button
      onClick={() => navigate(`/history/${workout.id}`)}
      className="w-full text-left flex items-center gap-3 px-4 py-4 border-b border-border active:bg-border/20 transition-colors last:border-b-0"
    >
      {/* Date block */}
      <div className="flex flex-col items-center shrink-0 w-10">
        <span className="text-[10px] text-muted-foreground uppercase">
          {format(date, 'EEE')}
        </span>
        <span className="text-xl font-extrabold text-foreground tabular-nums leading-tight">
          {format(date, 'd')}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {format(date, 'MMM')}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Categories */}
        {workout.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {workout.categories.map((cat) => (
              <Badge
                key={cat}
                variant="outline"
                className="text-[9px] px-1.5 py-0 border-border text-muted-foreground capitalize h-4"
              >
                {CATEGORY_LABEL[cat]}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums flex-wrap">
          <span>{workout.durationMinutes} min</span>
          {workout.volumeLbs > 0 && (
            <>
              <span className="text-border">·</span>
              <span>{formatVolume(workout.volumeLbs)}</span>
            </>
          )}
          {workout.xp_earned > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="font-bold">+{workout.xp_earned} XP</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
