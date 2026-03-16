import type { WorkoutSet, Exercise } from '@/types';

const MAX_VISIBLE = 6;

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'a week ago';
  if (diffDays < 21) return '2 weeks ago';
  if (diffDays < 28) return '3 weeks ago';
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'a month ago';
  return `${diffMonths} months ago`;
}

function formatSet(set: WorkoutSet, isCardio: boolean): string {
  if (isCardio) return `${set.weight_lbs}mi × ${set.reps}min`;
  return `${set.weight_lbs}×${set.reps}`;
}

interface PreviousSetsPreviewProps {
  lastWorkedAt: string;
  sets: WorkoutSet[];
  exercise: Exercise;
}

export default function PreviousSetsPreview({
  lastWorkedAt,
  sets,
  exercise,
}: PreviousSetsPreviewProps) {
  const isCardio = exercise.category === 'cardio';
  const visible = sets.slice(0, MAX_VISIBLE);
  const hiddenCount = sets.length - visible.length;

  return (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap leading-relaxed">
      <span className="shrink-0">{relativeTime(lastWorkedAt)}</span>
      <span className="shrink-0 text-border">·</span>
      <span className="flex flex-wrap gap-x-2 gap-y-0.5">
        {visible.map((set, i) => (
          <span key={i} className="tabular-nums">
            {formatSet(set, isCardio)}
          </span>
        ))}
        {hiddenCount > 0 && <span>+{hiddenCount} more</span>}
      </span>
    </div>
  );
}
