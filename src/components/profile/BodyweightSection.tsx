import { useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBodyweightLogs } from '@/hooks/useBodyweightLogs';
import { fromLbs } from '@/lib/units';
import LogWeightModal from '@/components/home/LogWeightModal';
import type { WeightUnit } from '@/types';

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded bg-surface border border-border px-2 py-1 text-xs text-foreground shadow">
      {payload[0].value}
    </div>
  );
}

interface BodyweightSectionProps {
  unit: WeightUnit;
}

export default function BodyweightSection({ unit }: BodyweightSectionProps) {
  const { logs } = useBodyweightLogs();
  const [modalOpen, setModalOpen] = useState(false);

  const latest = logs[0] ?? null;

  // Last 30 entries for chart (logs is newest-first, chart wants oldest-first)
  const chartLogs = [...logs].slice(0, 30).reverse();
  const chartData = chartLogs.map((l) => ({
    date: l.logged_at.slice(5, 10), // MM-DD
    weight: Math.round(fromLbs(l.weight_lbs, unit) * 10) / 10,
  }));

  return (
    <div className="space-y-3">
      {/* Latest + log button */}
      <div className="flex items-center justify-between px-4">
        {latest ? (
          <div>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {Math.round(fromLbs(latest.weight_lbs, unit) * 10) / 10} {unit}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(parseISO(latest.logged_at), { addSuffix: true })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-border text-muted-foreground gap-1.5"
          onClick={() => setModalOpen(true)}
        >
          <Scale className="h-3.5 w-3.5" />
          Log Weight
        </Button>
      </div>

      {/* Mini chart */}
      {chartData.length >= 2 && (
        <div className="px-4">
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={32}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="weight" stroke="var(--primary)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <LogWeightModal open={modalOpen} onOpenChange={setModalOpen} unit={unit} />
    </div>
  );
}
