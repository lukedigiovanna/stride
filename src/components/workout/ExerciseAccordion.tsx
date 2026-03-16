import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
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
import { formatWeight } from '@/lib/units';
import { useWorkout } from '@/context/WorkoutContext';
import { useExercisePreviousSets } from '@/hooks/useExercisePreviousSets';
import SetRow from './SetRow';
import SetLogger from './SetLogger';
import PreviousSetsPreview from './PreviousSetsPreview';
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
  previousData: { lastWorkedAt: string; sets: import('@/types').WorkoutSet[] } | null;
  isExpanded: boolean;
  onToggle: () => void;
  sevenDayAvgLbs: number | null;
  weightUnit: WeightUnit;
}

function ExerciseCard({
  exercise,
  entry,
  previousData,
  isExpanded,
  onToggle,
  sevenDayAvgLbs,
  weightUnit,
}: ExerciseCardProps) {
  const sets = entry?.sets ?? [];
  const hasSessionSets = sets.length > 0;

  // ── Unworked + collapsed ─────────────────────────────────────────────────
  if (!hasSessionSets && !isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="w-full flex flex-col px-3 py-2.5 rounded-sm text-left active:bg-border/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground flex-1">{exercise.name}</span>
          <span className="text-xs text-muted-foreground capitalize">{exercise.equipment_type}</span>
        </div>
      </button>
    );
  }

  // ── Worked + collapsed ───────────────────────────────────────────────────
  if (hasSessionSets && !isExpanded) {
    const lastWeight = sets[sets.length - 1].weight_lbs;
    return (
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm border border-foreground/20 bg-surface text-left active:bg-foreground/8 transition-colors"
      >
        <span className="text-sm text-foreground flex-1">{exercise.name}</span>
        <span className="text-xs text-foreground font-bold tabular-nums">
          {sets.length} {sets.length === 1 ? 'set' : 'sets'} · {formatWeight(lastWeight, weightUnit)}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'rounded-sm border px-3 py-2.5 space-y-1',
        hasSessionSets ? 'border-foreground/25 bg-surface' : 'border-border bg-surface',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{exercise.name}</span>
        <div className="flex items-center gap-2">
          {hasSessionSets && (
            <span className="text-xs text-foreground font-bold tabular-nums">
              {sets.length} {sets.length === 1 ? 'set' : 'sets'}
            </span>
          )}
          <button
            onClick={onToggle}
            className="p-0.5 text-muted-foreground active:text-foreground"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Previous session reference */}
      {previousData && (
        <PreviousSetsPreview
          lastWorkedAt={previousData.lastWorkedAt}
          sets={previousData.sets}
          exercise={exercise}
        />
      )}

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
  const { activeWorkout } = useWorkout();
  const previousData = useExercisePreviousSets(activeWorkout?.workoutId ?? null);

  const [openCategory, setOpenCategory] = useState<string>('');
  // Multi-expand: track which exercise IDs are expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExercise(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Auto-expand exercises when their first set is logged in this session.
  // Using entries as dep — when a new exercise_id appears, add it to the set.
  useEffect(() => {
    const workedIds = Object.keys(entries);
    if (workedIds.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      workedIds.forEach((id) => next.add(id));
      return next;
    });
  }, [entries]);

  // Handle exercise selected from AddExerciseModal
  useEffect(() => {
    if (!pendingExercise) return;
    setOpenCategory(pendingExercise.category);
    setExpandedIds((prev) => new Set([...prev, pendingExercise.id]));
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

  // Build stable sort orders per category, keyed off previousData.
  // previousData only changes once (empty → populated after fetch), so the
  // computed order is effectively frozen for the session after first load.
  const sortedByCategory = useMemo(() => {
    const result: Record<string, Exercise[]> = {};
    for (const cat of CATEGORY_ORDER) {
      result[cat] = [...byCategory[cat]].sort((a, b) => {
        const aAt = previousData.get(a.id)?.lastWorkedAt ?? null;
        const bAt = previousData.get(b.id)?.lastWorkedAt ?? null;
        if (aAt && bAt) return bAt.localeCompare(aAt); // most recent first
        if (aAt) return -1;
        if (bAt) return 1;
        return a.name.localeCompare(b.name); // never done → alphabetical
      });
    }
    return result;
  }, [exercises, previousData]);

  return (
    <Accordion
      type="single"
      collapsible
      value={openCategory}
      onValueChange={(val) => {
        setOpenCategory(val);
      }}
      className="w-full"
    >
      {CATEGORY_ORDER.map((category) => {
        const { label, Icon } = CATEGORY_META[category];
        const categoryExercises = byCategory[category];
        const sorted = sortedByCategory[category] ?? categoryExercises;
        const workedCount = categoryExercises.filter((e) => entries[e.id]).length;

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
                  <Badge className="h-5 px-1.5 text-[10px] bg-foreground text-background rounded-sm">
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
                  {sorted.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      entry={entries[exercise.id]}
                      previousData={previousData.get(exercise.id) ?? null}
                      isExpanded={expandedIds.has(exercise.id)}
                      onToggle={() => toggleExercise(exercise.id)}
                      sevenDayAvgLbs={sevenDayAvgLbs}
                      weightUnit={weightUnit}
                    />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
