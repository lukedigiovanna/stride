import { useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Scale, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBodyweightLogs } from '@/hooks/useBodyweightLogs';
import { fromLbs } from '@/lib/units';
import LogWeightModal from '@/components/home/LogWeightModal';
import type { WeightUnit } from '@/types';

type Range = 'week' | 'months3' | 'year' | 'allTime';

const RANGE_LABELS: Record<Range, string> = {
  week: 'Week',
  months3: '3 Months',
  year: 'Year',
  allTime: 'All Time',
};

function getWeekWindow(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + offset * 7);
  sunday.setHours(0, 0, 0, 0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  return { start: sunday, end: saturday };
}

function weekLabel(offset: number, start: Date, end: Date): string {
  if (offset === 0) return 'This week';
  const startStr = format(start, 'MMM d');
  const endStr = start.getMonth() === end.getMonth()
    ? format(end, 'd')
    : format(end, 'MMM d');
  return `${startStr} – ${endStr}`;
}

function evenTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + i * step));
}

function linearRegression(points: { x: number; y: number }[]): number {
  const n = points.length;
  const sumX  = points.reduce((a, p) => a + p.x, 0);
  const sumY  = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function formatTrend(change: number, unit: WeightUnit): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)} ${unit}`;
}

interface TooltipPayloadEntry {
  value: number;
  payload: { ts: number; weight: number };
}

function ChartTooltip({ active, payload, unit }: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  unit: WeightUnit;
}) {
  if (!active || !payload?.length) return null;
  const { ts, weight } = payload[0].payload;
  return (
    <div className="rounded bg-surface border border-border px-2 py-1 text-xs text-foreground shadow space-y-0.5">
      <p className="text-muted-foreground">{format(new Date(ts), 'EEE, MMM d')}</p>
      <p className="font-semibold">{weight} {unit}</p>
    </div>
  );
}

interface BodyweightSectionProps {
  unit: WeightUnit;
}

export default function BodyweightSection({ unit }: BodyweightSectionProps) {
  const { logs } = useBodyweightLogs();
  const [modalOpen, setModalOpen] = useState(false);
  const [range, setRange] = useState<Range>('months3');
  const [weekOffset, setWeekOffset] = useState(0);

  const latest = logs[0] ?? null;

  // --- Filtered data ---
  let filtered: typeof logs;
  let xDomain: [number, number] | ['dataMin', 'dataMax'];
  let xTicks: number[];
  let windowMs: number;

  if (range === 'week') {
    const { start, end } = getWeekWindow(weekOffset);
    filtered = logs
      .filter(l => {
        const t = new Date(l.logged_at).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .reverse();
    xDomain = [start.getTime(), end.getTime()];
    xTicks = Array.from({ length: 7 }, (_, i) => start.getTime() + i * 86_400_000);
    windowMs = end.getTime() - start.getTime();
  } else {
    const now = Date.now();
    const cutoffs: Record<Exclude<Range, 'week'>, number> = {
      months3: now - 90  * 86_400_000,
      year:    now - 365 * 86_400_000,
      allTime: 0,
    };
    const cutoff = cutoffs[range as Exclude<Range, 'week'>];
    filtered = logs
      .filter(l => new Date(l.logged_at).getTime() >= cutoff)
      .reverse();
    xDomain = ['dataMin', 'dataMax'];
    const tsMin = filtered.length ? new Date(filtered[0].logged_at).getTime() : 0;
    const tsMax = filtered.length ? new Date(filtered[filtered.length - 1].logged_at).getTime() : 0;
    xTicks = filtered.length >= 2 ? evenTicks(tsMin, tsMax, 5) : [];
    const windowMap: Record<Exclude<Range, 'week'>, number> = {
      months3: 90  * 86_400_000,
      year:    365 * 86_400_000,
      allTime: 0,
    };
    windowMs = windowMap[range as Exclude<Range, 'week'>];
  }

  const chartData = filtered.map(l => ({
    ts: new Date(l.logged_at).getTime(),
    weight: Math.round(fromLbs(l.weight_lbs, unit) * 10) / 10,
  }));

  // --- Trend ---
  let trendText: string | null = null;
  if (filtered.length >= 2) {
    const points = chartData.map(d => ({ x: d.ts, y: d.weight }));
    const slope = linearRegression(points);
    // Use actual data span rather than full window, so a 3-month view with
    // only 2 weeks of data doesn't extrapolate trend across the empty period.
    const actualSpan = points[points.length - 1].x - points[0].x;
    const effectiveMs = range === 'week' ? windowMs : actualSpan;
    const totalChange = slope * effectiveMs;
    const changeStr = formatTrend(totalChange, unit);
    if (range === 'week') {
      const { start } = getWeekWindow(weekOffset);
      const suffix = weekOffset === 0 ? 'this week' : `week of ${format(start, 'MMM d')}`;
      trendText = `${changeStr} ${suffix}`;
    } else if (range === 'months3') {
      trendText = `${changeStr} over last 3 months`;
    } else if (range === 'year') {
      trendText = `${changeStr} over last year`;
    } else {
      trendText = `${changeStr} all time`;
    }
  }

  const notEnoughData = range !== 'allTime' && filtered.length === 1;

  // --- X-axis tick formatter ---
  const tickFormatter = (val: number): string => {
    const d = new Date(val);
    if (range === 'week') return format(d, 'EEE');
    if (range === 'months3') return format(d, 'MMM d');
    return format(d, "MMM ''yy");
  };

  // Week nav
  const { start: weekStart, end: weekEnd } = range === 'week'
    ? getWeekWindow(weekOffset)
    : { start: new Date(), end: new Date() };

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
              {trendText && (
                <span className="font-bold ml-1">· {trendText}</span>
              )}
              {notEnoughData && (
                <span className="ml-1">· Not enough data for trend</span>
              )}
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

      {/* Range tabs */}
      <div className="flex gap-4 px-4">
        {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
          <button
            key={r}
            onClick={() => { setRange(r); if (r === 'week') setWeekOffset(0); }}
            className={`text-xs pb-0.5 transition-colors ${
              range === r
                ? 'text-foreground font-bold border-b border-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Week navigation */}
      {range === 'week' && (
        <div className="flex items-center gap-2 px-4">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-foreground flex-1 text-center">
            {weekLabel(weekOffset, weekStart, weekEnd)}
          </span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            disabled={weekOffset === 0}
            className={`transition-colors ${
              weekOffset === 0
                ? 'text-muted-foreground opacity-40 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Chart or empty state */}
      <div className="px-4 h-[100px]">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No data in this range.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={xDomain}
                ticks={xTicks}
                tickFormatter={tickFormatter}
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={32}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--primary)"
                dot={filtered.length === 1}
                strokeWidth={2}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <LogWeightModal open={modalOpen} onOpenChange={setModalOpen} unit={unit} />
    </div>
  );
}
