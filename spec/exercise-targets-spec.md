# Exercise Targets Spec
**Feature:** Per-user, per-exercise target sets, rep range, and rest range

---

## Overview

Users can optionally set a **target set count** (e.g., 3 sets), **target rep range** (e.g., 8–12 reps), and **target rest range** (e.g., 60–90 seconds) for any exercise. These targets are personal, optional, and informational — they guide the user while logging without enforcing anything. Targets are displayed inline when an exercise is expanded in the workout sheet and are editable on the exercise detail page.

Targets are hidden entirely for cardio exercises.

---

## Decisions

- Rest values are displayed in formatted minutes (e.g., `1m 30s`, `1m–1m 30s`)
- Rest timer remains fully manual with no changes
- Cardio exercises have no targets
- Target sets (count) is included alongside rep range and rest range

---

## Database

### New Table: `user_exercise_targets`

```sql
CREATE TABLE user_exercise_targets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id             uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  target_sets_min         integer CHECK (target_sets_min > 0),
  target_sets_max         integer CHECK (target_sets_max > 0),
  target_reps_min         integer CHECK (target_reps_min > 0),
  target_reps_max         integer CHECK (target_reps_max > 0),
  target_rest_seconds_min integer CHECK (target_rest_seconds_min > 0),
  target_rest_seconds_max integer CHECK (target_rest_seconds_max > 0),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE (user_id, exercise_id),
  CHECK (
    target_sets_min IS NULL OR target_sets_max IS NULL
    OR target_sets_min <= target_sets_max
  ),
  CHECK (
    target_reps_min IS NULL OR target_reps_max IS NULL
    OR target_reps_min <= target_reps_max
  ),
  CHECK (
    target_rest_seconds_min IS NULL OR target_rest_seconds_max IS NULL
    OR target_rest_seconds_min <= target_rest_seconds_max
  )
);
```

**RLS Policies:**
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id`
- `UPDATE`: `auth.uid() = user_id`
- `DELETE`: `auth.uid() = user_id`

**Notes:**
- All target fields are optional. A row may have any combination of the three target types set.
- Either bound of a rep/rest range may be null: `min=8, max=null` means "at least 8"; `min=10, max=10` means "exactly 10".
- If no row exists for a (user, exercise) pair, the user has no targets for that exercise.

---

## Type Definitions

Add to `src/types/index.ts`:

```ts
export interface ExerciseTarget {
  id: string;
  user_id: string;
  exercise_id: string;
  target_sets_min: number | null;
  target_sets_max: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_rest_seconds_min: number | null;
  target_rest_seconds_max: number | null;
  created_at: string;
  updated_at: string;
}
```

---

## Data Layer

### New Hook: `useExerciseTargets.ts`

```ts
// src/hooks/useExerciseTargets.ts
useExerciseTargets(exerciseId: string): {
  target: ExerciseTarget | null;
  isLoading: boolean;
  upsertTarget: (values: Partial<Pick<ExerciseTarget,
    | 'target_sets_min' | 'target_sets_max'
    | 'target_reps_min' | 'target_reps_max'
    | 'target_rest_seconds_min' | 'target_rest_seconds_max'
  >>) => Promise<void>;
  clearTarget: () => Promise<void>;
}
```

- Uses `supabase.from('user_exercise_targets').upsert(...)` with `onConflict: 'user_id,exercise_id'`
- `clearTarget` deletes the row
- Fetches once on mount; re-fetches after any write

### Workout Sheet Bulk Fetch

The workout sheet needs targets for all exercises in the session without N individual fetches. Add a bulk fetch in `WorkoutContext` or a dedicated hook:

```ts
// Fetch once on session start (alongside existing previous-sets fetch)
SELECT * FROM user_exercise_targets WHERE user_id = $uid
```

Return as `Map<exerciseId, ExerciseTarget>`. Pass as a prop through `WorkoutSheet` → `ExerciseAccordion` → `ExerciseCard`.

---

## Display Helpers

### Rest formatting

Convert seconds to a human-readable string:

```ts
// Examples:
// 45  → "45s"
// 60  → "1m"
// 90  → "1m 30s"
// 120 → "2m"
formatRestSeconds(s: number): string
```

### Range string helpers

```ts
// Rep range
// min=8, max=12 → "8–12 reps"
// min=10, max=10 → "10 reps"
// min=8, max=null → "≥8 reps"
// min=null, max=12 → "≤12 reps"
formatRepRange(min: number | null, max: number | null): string

// Rest range (uses formatRestSeconds internally)
// min=60, max=90 → "1m–1m 30s"
// min=60, max=60 → "1m"
// min=60, max=null → "≥1m"
formatRestRange(min: number | null, max: number | null): string

// Sets range (same pattern as reps)
// min=3, max=5 → "3–5 sets"
// min=3, max=3 → "3 sets"
// min=3, max=null → "≥3 sets"
// min=null, max=5 → "≤5 sets"
formatSetRange(min: number | null, max: number | null): string
```

---

## UI

### 1. Workout Sheet — ExerciseCard (expanded state)

Show a compact target hint row just below the exercise header and above the previous sets preview.

**Display format (examples):**
```
3–4 sets · 8–12 reps · 1m–1m 30s rest
8–12 reps · 1m 30s rest
3 sets
```

- Only the segments that have values are shown, joined by ` · `
- If all three are unset: hide the row entirely
- Styling: `text-xs text-muted-foreground`, with a small amber `Target:` prefix label or dot

### 2. Exercise Detail Page — Targets Section

Add a "Your Targets" section on `ExerciseDetailPage` (`/exercises/:id`). Hidden for `exercise.category === 'cardio'`.

**Display state (no targets set):**
```
Your Targets                        [Set targets]
No targets set.
```

**Display state (targets set):**
```
Your Targets                        [Edit ✏]
Sets:  3–4
Reps:  8–12
Rest:  1m–1m 30s
```

(Only rows with values are shown)

**Edit mode (inline form, replaces display):**

Fields:
| Label | Input | Notes |
|---|---|---|
| Min sets | Number input | Nullable |
| Max sets | Number input | Nullable |
| Min reps | Number input | Nullable |
| Max reps | Number input | Nullable |
| Min rest | Number input (seconds) | Nullable; display hint "(seconds)" |
| Max rest | Number input (seconds) | Nullable; display hint "(seconds)" |

- "Save" / "Cancel" buttons
- Client-side validation:
  - All values must be positive integers if set
  - `min ≤ max` if both set bounds are set
  - `min ≤ max` if both rep bounds are set
  - `min ≤ max` if both rest bounds are set
- On save: calls `upsertTarget` with current field values; nulls out any blank fields
- If all fields are cleared on save: calls `clearTarget` to delete the row

---

## Supabase Setup Checklist

- [ ] Create `user_exercise_targets` table with constraints above
- [ ] Enable RLS on `user_exercise_targets`
- [ ] Add all four RLS policies (select / insert / update / delete)
- [ ] Add `updated_at` auto-update trigger

---

## Out of Scope (v1)

- Rest timer pre-population from target rest range
- In-session highlighting when rep count is within target range
- Cardio-specific targets (distance / duration)
- Sharing or copying targets between users or exercises
