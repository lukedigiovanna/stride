import { useState } from 'react';
import { Trash2, Check, X } from 'lucide-react';
import { useWorkout } from '@/context/WorkoutContext';
import type { WorkoutSet, Exercise } from '@/types';

interface SetRowProps {
  set: WorkoutSet;
  exercise: Exercise;
  setNumber: number;
}

/**
 * Displays a single logged set. Tap row to enter edit mode; trash to delete.
 * Cardio sets show distance × duration labels instead of lbs × reps.
 */
export default function SetRow({ set, exercise, setNumber }: SetRowProps) {
  const { updateSet, deleteSet } = useWorkout();
  const isCardio = exercise.category === 'cardio';

  const [isEditing, setIsEditing] = useState(false);
  const [weightVal, setWeightVal] = useState(String(set.weight_lbs));
  const [repsVal, setRepsVal] = useState(String(set.reps));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const w = parseFloat(weightVal);
    const r = parseFloat(repsVal);
    if (isNaN(w) || isNaN(r) || w < 0 || r < 0) return;
    setIsSaving(true);
    try {
      await updateSet(set.id, w, r);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setWeightVal(String(set.weight_lbs));
    setRepsVal(String(set.reps));
    setIsEditing(false);
  }

  const displayText = isCardio
    ? `${set.weight_lbs} mi  ×  ${set.reps} min`
    : `${set.weight_lbs} lbs  ×  ${set.reps} reps`;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-1">
        <span className="text-xs text-muted-foreground w-5 text-center shrink-0 tabular-nums">
          {setNumber}
        </span>

        <input
          type="number"
          inputMode="decimal"
          value={weightVal}
          onChange={(e) => setWeightVal(e.target.value)}
          className="w-16 text-xs bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 py-1 text-center text-foreground focus:outline-none focus:border-foreground"
          placeholder={isCardio ? 'mi' : 'lbs'}
          autoFocus
        />

        <span className="text-xs text-muted-foreground">×</span>

        <input
          type="number"
          inputMode="decimal"
          value={repsVal}
          onChange={(e) => setRepsVal(e.target.value)}
          className="w-14 text-xs bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 py-1 text-center text-foreground focus:outline-none focus:border-foreground"
          placeholder={isCardio ? 'min' : 'reps'}
        />

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-1 text-foreground active:opacity-70"
          >
            <Check className="h-4 w-4" />
          </button>
          <button onClick={handleCancel} className="p-1 text-muted-foreground active:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <span className="text-xs text-muted-foreground w-5 text-center shrink-0 tabular-nums">
        {setNumber}
      </span>

      <button
        onClick={() => setIsEditing(true)}
        className="flex-1 text-left text-sm text-foreground tabular-nums"
      >
        {displayText}
      </button>

      <button
        onClick={() => deleteSet(set.id)}
        className="p-1 text-muted-foreground active:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
