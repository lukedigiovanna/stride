import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useWorkout } from '@/context/WorkoutContext';
import { toLbs } from '@/lib/units';
import type { Exercise, WorkoutSet, WeightUnit } from '@/types';

interface SetLoggerProps {
  exercise: Exercise;
  /** The most recently logged set in this session (for pre-fill). */
  lastSet: WorkoutSet | null;
  /** 7-day average bodyweight in lbs — used for bodyweight exercise pre-fill. */
  sevenDayAvgLbs: number | null;
  /** User's preferred weight unit (for bodyweight display). */
  weightUnit: WeightUnit;
}

/**
 * Inline set-entry form. Adapts its fields based on exercise type:
 *   - Strength / Misc: weight (lbs) + reps
 *   - Bodyweight: weight pre-filled from 7-day avg + reps
 *   - Cardio: distance (mi) + duration (min)
 */
export default function SetLogger({
  exercise,
  lastSet,
  sevenDayAvgLbs,
  weightUnit,
}: SetLoggerProps) {
  const { logSet } = useWorkout();
  const isCardio = exercise.category === 'cardio';
  const isBodyweight = exercise.equipment_type === 'bodyweight';

  // Pre-fill logic
  const defaultWeight = (() => {
    if (isCardio) return '';
    if (lastSet) return String(lastSet.weight_lbs);
    if (isBodyweight && sevenDayAvgLbs !== null) return String(Math.round(sevenDayAvgLbs));
    return '';
  })();
  const defaultReps = lastSet ? String(lastSet.reps) : '';

  const [weightVal, setWeightVal] = useState(defaultWeight);
  const [repsVal, setRepsVal] = useState(defaultReps);
  const [isLogging, setIsLogging] = useState(false);

  const canSubmit = isCardio
    ? weightVal !== '' && repsVal !== '' && parseFloat(weightVal) > 0 && parseFloat(repsVal) > 0
    : weightVal !== '' && repsVal !== '' && parseFloat(weightVal) >= 0 && parseFloat(repsVal) > 0;

  async function handleLog() {
    if (!canSubmit) return;
    const w = parseFloat(weightVal);
    const r = parseFloat(repsVal);

    setIsLogging(true);
    try {
      // For cardio: w = distance (miles), r = duration_minutes — stored as-is in lbs/reps columns
      // For strength/bodyweight: w is already in lbs
      const weightLbs = isCardio ? w : toLbs(w, 'lbs'); // already in lbs; toLbs is a no-op here
      await logSet(exercise, weightLbs, r);

      // After logging, pre-fill with what was just entered
      // (keep weight, reset reps only for cardio to avoid reuse)
      if (isCardio) {
        setWeightVal('');
        setRepsVal('');
      }
    } catch {
      toast.error('Failed to log set.');
    } finally {
      setIsLogging(false);
    }
  }

  if (isCardio) {
    return (
      <div className="flex items-end gap-2 pt-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Distance
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={weightVal}
              onChange={(e) => setWeightVal(e.target.value)}
              placeholder="0.0"
              className="w-20 text-sm bg-background border border-border rounded px-2 py-1.5 text-center text-foreground"
            />
            <span className="text-xs text-muted-foreground">mi</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Duration
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={repsVal}
              onChange={(e) => setRepsVal(e.target.value)}
              placeholder="0"
              className="w-20 text-sm bg-background border border-border rounded px-2 py-1.5 text-center text-foreground"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleLog}
          disabled={!canSubmit || isLogging}
          className="ml-auto"
        >
          {isLogging ? '…' : 'Log'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 pt-2">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Weight
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={weightVal}
            onChange={(e) => setWeightVal(e.target.value)}
            placeholder="0"
            className="w-20 text-sm bg-background border border-border rounded px-2 py-1.5 text-center text-foreground"
          />
          <span className="text-xs text-muted-foreground">{weightUnit}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Reps
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={repsVal}
          onChange={(e) => setRepsVal(e.target.value)}
          placeholder="0"
          className="w-16 text-sm bg-background border border-border rounded px-2 py-1.5 text-center text-foreground"
        />
      </div>

      <Button
        size="sm"
        onClick={handleLog}
        disabled={!canSubmit || isLogging}
        className="ml-auto"
      >
        {isLogging ? '…' : 'Log Set'}
      </Button>

      {isBodyweight && sevenDayAvgLbs !== null && (
        <p className="text-[10px] text-muted-foreground mt-1 col-span-full">
          Using your 7-day avg bodyweight
        </p>
      )}
    </div>
  );
}
