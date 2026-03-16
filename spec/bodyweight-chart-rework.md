# Bodyweight Chart Rework — Implementation Spec

## Goals

1. Replace the current indexed X-axis with a true time-axis (evenly spaced dates).
2. Add a time range selector: **Week**, **Last 3 Months**, **Last Year**, **All Time**.
3. Weekly view supports stepping back/forward through calendar weeks (Sun–Sat).
4. Show a trend summary for all ranges except All Time.
5. Handle the no-data-in-range case with a friendly empty state inside the chart area.

---

## Time Range Filter

Four options rendered as a small tab row above the chart:

| Label | Window |
|---|---|
| Week | Calendar week (Sun–Sat), steppable |
| Last 3 Months | 90 days back from today |
| Last Year | 365 days back from today |
| All Time | All logs |

- Default selection: **Last 3 Months**.
- Selection is local component state (not persisted).
- All four tabs always visible and clickable.

---

## Weekly View: Calendar Week Navigation

The "Week" tab is special — it shows a fixed Sun–Sat window that can be stepped backward and forward in time.

### State

```ts
// weekOffset = 0 → current week, -1 → last week, -2 → two weeks ago, etc.
const [weekOffset, setWeekOffset] = useState(0);
```

### Window computation

```ts
function getWeekWindow(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day + offset * 7);
  sunday.setHours(0, 0, 0, 0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  return { start: sunday, end: saturday };
}
```

- Filter logs to `logged_at >= start && logged_at <= end`.
- X-axis domain is always `[start.getTime(), end.getTime()]` — fixed to the full Sun–Sat span regardless of where data falls. This ensures the timeline doesn't collapse when data is sparse.

### Navigation controls

Rendered inline with the week label, between `<` and `>` arrow buttons:

```
[ < ]  [ This week / Mar 9 – 15 ]  [ > ]
```

- **Right `>` arrow**: disabled and visually grayed out when `weekOffset === 0` (current week). Not hidden.
- **Left `<` arrow**: always enabled (no cap on how far back you can go).
- **Week label**:
  - `weekOffset === 0` → `"This week"`
  - Any other offset → `"Mar 9 – 15"` (format: `MMM d – d`, same month) or `"Feb 26 – Mar 4"` (cross-month)

### X-axis ticks for weekly view

Always show 7 fixed ticks — one per day (Sun through Sat) — regardless of data:

```ts
const ticks = Array.from({ length: 7 }, (_, i) => start.getTime() + i * 86400_000);
```

Tick format: `EEE` abbreviated day name (e.g. "Sun", "Mon").

### Trend for weekly view

- Same linear regression as other ranges (see below).
- Window for total change = `end.getTime() - start.getTime()` (always 7 days).
- Label: `+0.5 lbs this week` (or `+0.5 lbs week of Mar 9` for past weeks).
- Only shown when `filtered.length >= 2`.

---

## Non-Weekly Views: Data Filtering

```ts
const now = Date.now();
const cutoffs: Record<'months3' | 'year' | 'allTime', number> = {
  months3: now - 90  * 86400_000,
  year:    now - 365 * 86400_000,
  allTime: 0,
};

const filtered = logs
  .filter(l => new Date(l.logged_at).getTime() >= cutoffs[range])
  .reverse(); // oldest-first for chart
```

---

## X-Axis: True Timeline

**Fix**: use numeric timestamps as the Recharts `XAxis` dataKey.

### Implementation

- `chartData` entries: `{ ts: number (unix ms), weight: number }`
- `XAxis` props:
  - `dataKey="ts"`
  - `type="number"`
  - `scale="time"`
  - `domain` — fixed `[start, end]` for weekly view; `['dataMin', 'dataMax']` for others
  - `tickFormatter` — format based on active range:
    - Week → `EEE` (e.g. "Mon")
    - Last 3 Months → `MMM d`
    - Last Year → `MMM 'yy` (e.g. "Mar '25")
    - All Time → `MMM 'yy`
  - `ticks` — 7 fixed day ticks for weekly view; ~5 evenly-spaced computed ticks for others (see below)

### Tick generation for non-weekly views

```ts
function evenTicks(min: number, max: number, count = 5): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + i * step));
}
```

---

## Trend Calculation (all ranges except All Time)

Use **linear regression (least-squares)** over the filtered dataset, then multiply slope by window duration for total change.

```ts
function linearRegression(points: { x: number; y: number }[]): number {
  const n = points.length;
  const sumX  = points.reduce((a, p) => a + p.x, 0);
  const sumY  = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX); // display_unit / ms
}
```

- Input: `{ x: timestamp_ms, y: weight_in_display_unit }`
- Total change = `slope × windowMs`
- `windowMs`:
  - Week: `end.getTime() - start.getTime()` (7 days, fixed)
  - Last 3 Months: `90 * 86400_000`
  - Last Year: `365 * 86400_000`
  - All Time: n/a
- Format: `+0.5 lbs this week`, `-2.3 lbs over last 3 months`, etc.
  - Always show explicit `+` or `-` sign.
  - Round to 1 decimal place.

### Trend label copy by range

| Range | Label suffix |
|---|---|
| Week (current) | `this week` |
| Week (past) | `week of Mar 9` |
| Last 3 Months | `over last 3 months` |
| Last Year | `over last year` |
| All Time | *(not shown)* |

- Shown only when `filtered.length >= 2`.
- If `filtered.length === 1` and range is not All Time: show `"Not enough data for trend"` in muted text.

---

## Empty State (no data in range)

When `filtered.length === 0`, render a centered muted message inside the chart container:

```
No data in this range.
```

For the weekly view, "no data" means no logs fall within the Sun–Sat window. The chart container maintains its fixed height so layout does not shift.

---

## Tooltip

Show both formatted date and weight value:

```
Mon, Mar 12
185.5 lbs
```

Payload entry carries `ts` for date formatting.

---

## UI Layout

```
[ current weight ]                    [ Log Weight button ]
[ X ago · +0.5 lbs this week ]

[ Week | Last 3 Months | Last Year | All Time ]

-- weekly view only --
[ < ]  This week  [ > (grayed) ]

[ chart ]
```

- Range tabs: small text tabs, amber underline on active. No background pill.
- Trend text: inline with "X ago", separated by ` · `, rendered in amber/accent color.
- If All Time selected, just show "X ago" with no trend suffix.
- Week nav row only visible when "Week" tab is active.
- `>` arrow: `opacity-40 cursor-not-allowed pointer-events-none` when `weekOffset === 0`.

---

## Files to Change

| File | Change |
|---|---|
| `src/components/profile/BodyweightSection.tsx` | Full rework per this spec |

No hook changes needed — all logs are already loaded in memory; filtering and regression are pure client-side computations.

---

## Edge Cases

| Case | Behavior |
|---|---|
| 0 logs in range/week | Empty state message, no chart rendered |
| 1 log in range/week | Chart renders single dot, no trend shown |
| 2+ logs, all same weight | Trend shows `+0.0 lbs …` |
| All Time selected | No trend label shown regardless of data |
| Unit toggle (lbs ↔ kg) | Regression runs on display-unit values; trend label matches unit |
| Week straddles month boundary | Week label uses cross-month format: `"Feb 26 – Mar 4"` |
| Current week is partial (e.g. today is Wed) | Domain still spans full Sun–Sat; empty days just have no data points |
