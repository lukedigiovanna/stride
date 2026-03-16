import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useExercises } from '@/hooks/useExercises';
import type { ExerciseCategory, EquipmentType } from '@/types';

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'legs',   label: 'Legs'   },
  { value: 'push',   label: 'Push'   },
  { value: 'pull',   label: 'Pull'   },
  { value: 'core',   label: 'Core'   },
  { value: 'cardio', label: 'Cardio' },
  { value: 'misc',   label: 'Misc'   },
];

const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: 'dumbbell',   label: 'Dumbbell'   },
  { value: 'barbell',    label: 'Barbell'    },
  { value: 'cable',      label: 'Cable'      },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'machine',    label: 'Machine'    },
  { value: 'other',      label: 'Other'      },
];

interface CreateExerciseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const selectClass =
  'w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

export default function CreateExerciseModal({ open, onOpenChange }: CreateExerciseModalProps) {
  const { createExercise } = useExercises();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('push');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('dumbbell');
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setName('');
    setCategory('push');
    setEquipmentType('dumbbell');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await createExercise({
        name: name.trim(),
        category,
        equipment_type: equipmentType,
      });
      toast.success(`"${name.trim()}" created.`);
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Failed to create exercise.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-surface border-border">
        <DialogHeader>
          <DialogTitle>New Exercise</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Incline Dumbbell Press"
              className="bg-background border-border"
              autoFocus
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
              className={selectClass}
            >
              {CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Equipment type */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Equipment</label>
            <select
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value as EquipmentType)}
              className={selectClass}
            >
              {EQUIPMENT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
