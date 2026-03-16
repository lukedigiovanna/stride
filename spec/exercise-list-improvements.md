# Exercise List Improvements

## Overview

Two related improvements to the exercise accordion in the active workout sheet:

1. **Static sort order** — exercise order within a category is frozen at workout start based on historical data, so logging a set never causes the list to jump around.
2. **Previous session preview** — each exercise shows the sets from the last time it was worked (before the current workout), plus how long ago that was, so the user knows what weight/reps to target.

---

## Feature 1: Static Sort Order During Workout

### Problem

Currently, exercises are sorted by `lastLoggedAt` from the active workout entries. This means the moment a user logs a set on an exercise, that exercise jumps to the top of its category — which is disorienting mid-workout.

### Desired Behavior

- When the workout sheet is displayed, sort each category's exercises by **when they were last worked in a previous workout** (i.e., ignoring the current workout session entirely).
- This order stays frozen for the duration of the workout, regardless of what the user logs.
- Exercises never worked before go at the bottom of the category, sorted alphabetically among each other.

### Data Needed

For each exercise, we need the `logged_at` timestamp of the most recent set that belongs to a workout **other than the current one**.

One efficient approach: fetch, for each exercise, the most recent `workout_sets` row where `workout_id != currentWorkoutId`, ordered by `logged_at DESC`, limited to 1 row per exercise. This can be a single query using a lateral join or a subquery, run once when the workout sheet opens (or when the active workout is initialized).

### Implementation Plan

#### Step 1 — New hook: `useExerciseLastWorked(currentWorkoutId)`

Create `src/hooks/useExerciseLastWorked.ts`.

```
Returns: Map<exerciseId, { lastWorkedAt: string }>
```

Query logic:
```sql
SELECT DISTINCT ON (exercise_id)
  exercise_id,
  logged_at
FROM workout_sets
WHERE user_id = $userId
  AND workout_id != $currentWorkoutId
ORDER BY exercise_id, logged_at DESC
```

Fetch this once when `currentWorkoutId` is first set (i.e., when the active workout initializes). Cache the result in component state — do not re-fetch as sets are added.

#### Step 2 — Update `ExerciseAccordion.tsx` sort logic

Replace the current sort function (which uses `entries[id].lastLoggedAt`) with one that reads from the `useExerciseLastWorked` map:

```typescript
const sorted = [...categoryExercises].sort((a, b) => {
  const aWorked = lastWorkedMap[a.id]?.lastWorkedAt ?? null;
  const bWorked = lastWorkedMap[b.id]?.lastWorkedAt ?? null;
  if (aWorked && bWorked) return bWorked.localeCompare(aWorked); // most recent first
  if (aWorked) return -1;
  if (bWorked) return 1;
  return a.name.localeCompare(b.name); // neither worked before → alphabetical
});
```

This sort runs once when the component mounts (or when `lastWorkedMap` first populates) and is not re-triggered by logging sets.

#### Step 3 — Freeze the computed order

To ensure the order truly doesn't change mid-workout, memoize the sorted list using `useMemo` with dependencies `[categoryExercises, lastWorkedMap]`. Since `lastWorkedMap` is only populated once (no re-fetch), the order is stable.

---

## Feature 2: Previous Session Preview

### Desired Behavior

Under each exercise name in the accordion list, show a compact summary of:
- **How long ago** the exercise was last worked (e.g., "4 days ago", "a week ago", "3 weeks ago", "2 months ago")
- **Each set** from that session, in order: weight × reps (or distance × duration for cardio)

This is shown even when the exercise is collapsed (not expanded). It's read-only reference data.

### Relative Time Formatting

| Elapsed | Display |
|--------|---------|
| < 1 day | "Today" |
| 1 day | "Yesterday" |
| 2–6 days | "N days ago" |
| 7–13 days | "a week ago" |
| 14–20 days | "2 weeks ago" |
| 21–27 days | "3 weeks ago" |
| 28+ days | "N months ago" (rounded) |
| Never | *(nothing shown)* |

### Data Needed

For each exercise, we need all sets from the most recent previous workout session. This is a natural extension of Feature 1's data fetch: instead of just the timestamp, also fetch the full set list.

#### Extended hook: `useExercisePreviousSets(currentWorkoutId)`

Returns: `Map<exerciseId, { lastWorkedAt: string; sets: WorkoutSet[] }>`

Query strategy:
1. First query: get the most recent `workout_id` per exercise (same query as Feature 1 but also fetching `workout_id`).
2. Second query: fetch all sets for those `(exercise_id, workout_id)` pairs, ordered by `set_number ASC`.

This can be combined into a single roundtrip with a subquery or done as two sequential fetches. Given the limited number of exercises, two fetches is fine.

Alternatively, the first query can return all columns from `workout_sets` (not just `logged_at`), and client-side grouping can identify the most recent workout per exercise and collect its sets. This is simplest to implement:

```sql
SELECT *
FROM workout_sets
WHERE user_id = $userId
  AND workout_id != $currentWorkoutId
ORDER BY exercise_id, logged_at DESC
```

Then group by `exercise_id`, take the first `workout_id` seen per exercise, and collect all rows with that `workout_id`.

#### Performance note

This query may return a lot of rows over time. Add a `LIMIT` or date filter if needed (e.g., only look back 90 days). For now, rely on the index on `(user_id, exercise_id, logged_at)` to keep it fast.

### UI: `PreviousSetsPreview` component

New component: `src/components/workout/PreviousSetsPreview.tsx`

Render location: inside each exercise row in the accordion header (always visible, not just when expanded).

**Layout:**
```
Bench Press
  4 days ago  ·  135×10   145×10   155×8
```

- Time label: small muted text (e.g., `text-xs text-muted-foreground`)
- Separator dot between time and sets
- Sets rendered inline as `weight×reps` chips, space-separated
- Use user's weight unit preference for display (lbs vs kg)
- For cardio: render as `distanceXduration` using the same cardio formatting already used in `SetRow.tsx`
- If no previous data: render nothing (no placeholder text needed)
- If there are many sets (>6), show the first 6 and add `+N more` label

**Example markup sketch:**
```tsx
<div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
  <span>{relativeTime}</span>
  <span>·</span>
  <span className="flex flex-wrap gap-1">
    {sets.map(s => <span key={s.id}>{s.weight_lbs}×{s.reps}</span>)}
  </span>
</div>
```

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `src/hooks/useExercisePreviousSets.ts` | **Create** | Returns map of exerciseId → `{ lastWorkedAt, sets }` |
| `src/components/workout/PreviousSetsPreview.tsx` | **Create** | Compact previous-sets display row |
| `src/components/workout/ExerciseAccordion.tsx` | **Modify** | Use new hook for sort order; render `PreviousSetsPreview` in each row |

---

---

## Feature 3: Collapsible Exercise Cards (Multi-expand)

### Problem

The current implementation allows only one exercise to be expanded at a time (`expandedExerciseId: string | null`). Exercises that have sets logged are force-expanded and cannot be collapsed (`isExpanded || !!entry`). When logging many sets across multiple exercises (e.g., supersets), the list becomes very long with no way to collapse finished exercises.

### Desired Behavior

- **Multiple exercises can be open simultaneously** — needed for supersets where the user alternates between two exercises.
- **Exercises with sets can be collapsed** — once you're done with an exercise, you can collapse it to reclaim space.
- **Collapsed worked exercises** show a compact summary row (not the full set list + logger).
- **Auto-expand on first set** — when the first set is logged for an exercise, it auto-expands (same as current behavior when tapping an unworked exercise).
- **Adding from modal auto-expands** — the `pendingExercise` flow continues to work; the selected exercise opens automatically.

### Collapsed State for a Worked Exercise

When an exercise has sets but is collapsed, show a compact row similar to unworked exercises but visually distinct:

```
[Bench Press]          3 sets · 155 lbs   [chevron-down]
```

- Exercise name on the left
- Right side: set count + last set weight (mode weight from session sets)
- Chevron icon indicating it can be expanded
- Tapping anywhere on the row expands it

### Implementation Plan

#### Change to `ExerciseAccordion.tsx`

Replace:
```typescript
const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
```

With:
```typescript
const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(new Set());
```

Toggle function:
```typescript
function toggleExercise(id: string) {
  setExpandedExerciseIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}
```

Auto-expand when first set is logged — watch `entries` for changes and add newly-worked exercise IDs:
```typescript
useEffect(() => {
  const workedIds = Object.keys(entries);
  setExpandedExerciseIds(prev => {
    const next = new Set(prev);
    workedIds.forEach(id => next.add(id));
    return next;
  });
}, [entries]);
```

Pending exercise handler updates to use the set:
```typescript
useEffect(() => {
  if (!pendingExercise) return;
  setOpenCategory(pendingExercise.category);
  setExpandedExerciseIds(prev => new Set([...prev, pendingExercise.id]));
  onPendingHandled();
}, [pendingExercise, onPendingHandled]);
```

Pass `isExpanded` and `onToggle` to `ExerciseCard`:
```typescript
<ExerciseCard
  isExpanded={expandedExerciseIds.has(exercise.id)}
  onToggle={() => toggleExercise(exercise.id)}
  ...
/>
```

#### Changes to `ExerciseCard`

The card now has three possible states:

| State | Has sets | Is expanded | Render |
|-------|----------|-------------|--------|
| Unworked, collapsed | No | No | Compact tap-to-expand row (current behavior) |
| Worked, collapsed | Yes | No | **New** compact summary row with set count + weight + chevron |
| Expanded | Either | Yes | Full card with set list + logger (current behavior) |

Replace `onExpand` prop with `onToggle`:

```typescript
interface ExerciseCardProps {
  exercise: Exercise;
  entry: ActiveExerciseEntry | undefined;
  previousData: { lastWorkedAt: string; sets: WorkoutSet[] } | null; // Feature 2
  isExpanded: boolean;
  onToggle: () => void;
  sevenDayAvgLbs: number | null;
  weightUnit: WeightUnit;
}
```

Collapsed worked exercise row (new branch in the render):
```tsx
if (hasSessionSets && !isExpanded) {
  const lastWeight = sets[sets.length - 1].weight_lbs;
  const displayWeight = convertWeight(lastWeight, weightUnit);
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5 text-left active:bg-primary/10 transition-colors"
    >
      <span className="text-sm text-foreground flex-1">{exercise.name}</span>
      <span className="text-xs text-primary font-medium">
        {sets.length} {sets.length === 1 ? 'set' : 'sets'} · {displayWeight} {weightUnit}
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
```

The expanded card header gets a collapse button (chevron-up or X):
```tsx
<div className="flex items-center justify-between">
  <span className="text-sm font-semibold text-foreground">{exercise.name}</span>
  <div className="flex items-center gap-2">
    {hasSessionSets && (
      <span className="text-xs text-primary font-medium tabular-nums">
        {sets.length} {sets.length === 1 ? 'set' : 'sets'}
      </span>
    )}
    <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
      <ChevronUp className="h-4 w-4" />
    </button>
  </div>
</div>
```

---

## Clarifications Resolved

1. **Exercises worked in current session** — stay in historical position. Order is frozen at workout start.
2. **Never-worked exercises with no previous data** — show nothing (no label).
3. **Weight unit** — always match user preference (convert from lbs storage).
4. **Multiple exercises open** — yes, multi-expand. User may want two open for supersets.
5. **Collapsing worked exercises** — yes, collapse is allowed. Shows compact summary row when collapsed.
