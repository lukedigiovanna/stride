import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Exercise, ExerciseCategory } from '@/types';

const CATEGORIES: { value: ExerciseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'legs', label: 'Legs' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'misc', label: 'Misc' },
];

interface AddExerciseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
}

export default function AddExerciseModal({
  open,
  onOpenChange,
  exercises,
  onSelect,
}: AddExerciseModalProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return exercises.filter((e) => {
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchesSearch = q === '' || e.name.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [exercises, search, categoryFilter]);

  function handleSelect(exercise: Exercise) {
    onSelect(exercise);
    onOpenChange(false);
    setSearch('');
    setCategoryFilter('all');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-surface border-border flex flex-col max-h-[80dvh] p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Add Exercise</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative px-4">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {/* Category filter chips */}
        <div className="flex gap-1.5 overflow-x-auto px-4 py-2 no-scrollbar">
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

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No exercises found.</p>
          ) : (
            filtered.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => handleSelect(exercise)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left active:bg-border/30 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{exercise.name}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] border-border text-muted-foreground capitalize"
                >
                  {exercise.category}
                </Badge>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
