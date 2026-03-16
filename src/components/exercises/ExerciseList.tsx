import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Exercise, ExerciseCategory } from '@/types';

const CATEGORIES: { value: ExerciseCategory | 'all'; label: string }[] = [
  { value: 'all',    label: 'All'    },
  { value: 'legs',   label: 'Legs'   },
  { value: 'push',   label: 'Push'   },
  { value: 'pull',   label: 'Pull'   },
  { value: 'core',   label: 'Core'   },
  { value: 'cardio', label: 'Cardio' },
  { value: 'misc',   label: 'Misc'   },
];

interface ExerciseListProps {
  exercises: Exercise[];
  /** Map of exercise_id → current working weight (lbs). */
  weightMap: Record<string, number>;
  currentUserId: string;
}

function ExerciseRow({
  exercise,
  weight,
  isCustom,
}: {
  exercise: Exercise;
  weight: number | undefined;
  isCustom: boolean;
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/exercises/${exercise.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 active:bg-border/20 transition-colors text-left"
    >
      {/* Name + badges */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground">{exercise.name}</span>
          {isCustom && (
            <Badge variant="outline" className="text-[9px] px-1.5 border-primary/40 text-primary">
              Custom
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground capitalize">{exercise.category}</span>
          <span className="text-border text-[11px]">·</span>
          <span className="text-[11px] text-muted-foreground capitalize">{exercise.equipment_type}</span>
        </div>
      </div>

      {/* Working weight */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm tabular-nums text-muted-foreground">
          {weight !== undefined ? `${weight} lbs` : '—'}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

export default function ExerciseList({ exercises, weightMap, currentUserId }: ExerciseListProps) {
  const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return exercises.filter((e) => {
      const matchesCat = categoryFilter === 'all' || e.category === categoryFilter;
      const matchesSearch = q === '' || e.name.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [exercises, categoryFilter, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 no-scrollbar shrink-0 border-b border-border">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setCategoryFilter(value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
              categoryFilter === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-border text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative px-4 py-2 shrink-0 border-b border-border">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No exercises found.</p>
        ) : (
          <div className="rounded-none">
            {filtered.map((exercise) => (
              <ExerciseRow
                key={exercise.id}
                exercise={exercise}
                weight={weightMap[exercise.id]}
                isCustom={exercise.user_id === currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
