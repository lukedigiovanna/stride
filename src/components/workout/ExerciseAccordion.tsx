import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Dumbbell,
  Heart,
  MoreHorizontal,
  Target,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SetRow from './SetRow';
import SetLogger from './SetLogger';
import type {
  Exercise,
  ExerciseCategory,
  ActiveExerciseEntry,
  WeightUnit,
} from '@/types';

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  ExerciseCategory,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  legs:   { label: 'Legs',   Icon: Dumbbell        },
  push:   { label: 'Push',   Icon: ArrowUp         },
  pull:   { label: 'Pull',   Icon: ArrowDown       },
  core:   { label: 'Core',   Icon: Target          },
  cardio: { label: 'Cardio', Icon: Heart           },
  misc:   { label: 'Misc',   Icon: MoreHorizontal  },
};

const CATEGORY_ORDER: ExerciseCategory[] = [
  'legs', 'push', 'pull', 'core', 'cardio', 'misc',
];

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: Exercise;
  entry: ActiveExerciseEntry | undefined;
  isExpanded: boolean;
  onExpand: () => void;
  sevenDayAvgLbs: number | null;
  weightUnit: WeightUnit;
}

function ExerciseCard({
  exercise,
  entry,
  isExpanded,
  onExpand,
  sevenDayAvgLbs,
  weightUnit,
}: ExerciseCardProps) {
  const sets = entry?.sets ?? [];
  const hasSessionSets = sets.length > 0;

  if (!hasSessionSets && !isExpanded) {
    // Compact tappable row for unworked exercises
    return (
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left active:bg-border/30 transition-colors"
      >
        <span className="text-sm text-foreground flex-1">{exercise.name}</span>
        <span className="text-xs text-muted-foreground capitalize">{exercise.equipment_type}</span>
      </button>
    );
  }

  // Expanded card — shows sets + logger
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-1',
        hasSessionSets ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{exercise.name}</span>
        {hasSessionSets && (
          <span className="text-xs text-primary font-medium tabular-nums">
            {sets.length} {sets.length === 1 ? 'set' : 'sets'}
          </span>
        )}
      </div>

      {/* Logged sets */}
      {sets.map((set, idx) => (
        <SetRow key={set.id} set={set} exercise={exercise} setNumber={idx + 1} />
      ))}

      {/* Set logger input */}
      <SetLogger
        exercise={exercise}
        lastSet={sets.length > 0 ? sets[sets.length - 1] : null}
        sevenDayAvgLbs={sevenDayAvgLbs}
        weightUnit={weightUnit}
      />
    </div>
  );
}

// ─── ExerciseAccordion ────────────────────────────────────────────────────────

interface ExerciseAccordionProps {
  exercises: Exercise[];
  entries: Record<string, ActiveExerciseEntry>;
  sevenDayAvgLbs: number | null;
  weightUnit: WeightUnit;
  /**
   * When set, the accordion will open that exercise's category and expand
   * the exercise for logging. Cleared after handling.
   */
  pendingExercise: Exercise | null;
  onPendingHandled: () => void;
}

export default function ExerciseAccordion({
  exercises,
  entries,
  sevenDayAvgLbs,
  weightUnit,
  pendingExercise,
  onPendingHandled,
}: ExerciseAccordionProps) {
  const [openCategory, setOpenCategory] = useState<string>('');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  // Handle exercise selected from AddExerciseModal
  useEffect(() => {
    if (!pendingExercise) return;
    setOpenCategory(pendingExercise.category);
    setExpandedExerciseId(pendingExercise.id);
    onPendingHandled();
  }, [pendingExercise, onPendingHandled]);

  // Group exercises by category
  const byCategory = CATEGORY_ORDER.reduce<Record<ExerciseCategory, Exercise[]>>(
    (acc, cat) => {
      acc[cat] = exercises.filter((e) => e.category === cat);
      return acc;
    },
    { legs: [], push: [], pull: [], core: [], cardio: [], misc: [] },
  );

  return (
    <Accordion
      type="single"
      collapsible
      value={openCategory}
      onValueChange={(val) => {
        setOpenCategory(val);
        // Clear expanded exercise when switching categories
        if (val !== openCategory) setExpandedExerciseId(null);
      }}
      className="w-full"
    >
      {CATEGORY_ORDER.map((category) => {
        const { label, Icon } = CATEGORY_META[category];
        const categoryExercises = byCategory[category];
        const workedCount = categoryExercises.filter((e) => entries[e.id]).length;

        // Sort: worked exercises first (by lastLoggedAt desc), then unworked (alphabetical)
        const sorted = [...categoryExercises].sort((a, b) => {
          const aEntry = entries[a.id];
          const bEntry = entries[b.id];
          if (aEntry && bEntry) {
            return (bEntry.lastLoggedAt ?? '').localeCompare(aEntry.lastLoggedAt ?? '');
          }
          if (aEntry) return -1;
          if (bEntry) return 1;
          return a.name.localeCompare(b.name);
        });

        return (
          <AccordionItem
            key={category}
            value={category}
            className="border-border"
          >
            <AccordionTrigger className="px-1 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground">{label}</span>
                {workedCount > 0 && (
                  <Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground">
                    {workedCount}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-0 pb-3">
              {categoryExercises.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">No exercises in this category.</p>
              ) : (
                <div className="space-y-1.5">
                  {sorted.map((exercise) => {
                    const entry = entries[exercise.id];
                    const isExpanded = expandedExerciseId === exercise.id;
                    return (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        entry={entry}
                        isExpanded={isExpanded || !!entry}
                        onExpand={() => setExpandedExerciseId(exercise.id)}
                        sevenDayAvgLbs={sevenDayAvgLbs}
                        weightUnit={weightUnit}
                      />
                    );
                  })}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
