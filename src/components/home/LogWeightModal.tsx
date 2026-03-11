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
import { useBodyweightLogs } from '@/hooks/useBodyweightLogs';
import { toLbs } from '@/lib/units';
import type { WeightUnit } from '@/types';

interface LogWeightModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: WeightUnit;
}

export default function LogWeightModal({ open, onOpenChange, unit }: LogWeightModalProps) {
  const { logWeight } = useBodyweightLogs();
  const [value, setValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) return;

    setIsSaving(true);
    try {
      await logWeight(toLbs(parsed, unit));
      toast.success('Weight logged!');
      setValue('');
      onOpenChange(false);
    } catch {
      toast.error('Failed to log weight. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs bg-surface border-border">
        <DialogHeader>
          <DialogTitle>Log bodyweight</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.1"
              placeholder="0.0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="flex-1 bg-background border-border text-foreground"
              autoFocus
            />
            <span className="text-sm text-muted-foreground w-8">{unit}</span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!value || parseFloat(value) <= 0 || isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
