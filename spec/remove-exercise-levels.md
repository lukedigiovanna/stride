# Remove Exercise Level System

Remove the per-exercise level/progression system entirely. Replace the "level" display in the exercise list with the **current working weight** — defined as the mode weight from the most recent workout where the user performed that exercise (ties broken by the higher weight). Show `—` for exercises never performed, bodyweight, and cardio.

---

## Motivation

The per-exercise level concept (arbitrary level number, weight increments, level targets) adds complexity without value. The user already knows their working weight; surfacing the raw weight is more immediately useful than an opaque level number.

---

## Tasks

### 1. Database migration — drop `user_exercise_progress` table and `level_increment_lbs` column

Run in Supabase SQL editor (or as a migration file):

```sql
-- Drop the entire exercise progress tracking table
drop table if exists public.user_exercise_progress cascade;

-- Drop the level increment column from exercises
alter table public.exercises drop column if exists level_increment_lbs;
```

Update `spec/database-schema.md`:
- Remove the `level_increment_lbs` column entry from the `exercises` table.
- Remove the entire `user_exercise_progress` table section.
- Remove all references to level-up logic in the Notes section.

---

### 2. Remove TypeScript types

**File:** `src/types/index.ts`

- Remove `level_increment_lbs` from the `Exercise` interface.
- Remove the `UserExerciseProgress` interface entirely.
- Remove the `LevelUpResult` interface entirely.
- Remove any fields in other interfaces (e.g. `WorkoutDetailData`, `WorkoutSummary`) that reference `UserExerciseProgress` or `LevelUpResult`.

---

### 3. Delete level-up library files

Delete these files entirely — they exist solely to support the level system:

- `src/lib/levelUp.ts`
- `src/lib/levelUpBridge.ts`

---

### 4. Remove `LevelUpOverlay` component and its usage

- Delete `src/components/shared/LevelUpOverlay.tsx`.
- Remove its import and `<LevelUpOverlay />` render from `src/App.tsx`.

---

### 5. Remove `useExerciseProgress` hook

- Delete `src/hooks/useExerciseProgress.ts` — it exists solely to read/write `user_exercise_progress`.

---

### 6. Update `WorkoutContext` — remove level-up logic

**File:** `src/context/WorkoutContext.tsx`

- Remove imports: `checkLevelUp`, `createInitialProgress`, `UserExerciseProgress`, `LevelUpResult`.
- In `finishWorkout` (or equivalent): remove the block that queries `user_exercise_progress`, calls `checkLevelUp`, and upserts updated progress rows. Remove `levelUps` from the return value.
- In `addExercise` (or equivalent): remove the block that creates an initial progress row in `user_exercise_progress` when a new exercise is first added.
- Remove `levelUps` from the `WorkoutSummary` type / return shape if it exists there.

---

### 7. Update `ExerciseDetailPage` — remove level card/progress section

**File:** `src/pages/ExerciseDetailPage.tsx`

- Remove the `LevelCard` sub-component and all associated state/queries (`progress`, `hasLevelSystem`).
- Remove imports: `formatLevelTarget`, `UserExerciseProgress`, `useExerciseProgress` (if used).
- Remove the `user_exercise_progress` query from the page's data-loading logic.
- Remove the level progress section from the rendered JSX.

---

### 8. Update `ExercisesPage` — replace progress query with working-weight query

**File:** `src/pages/ExercisesPage.tsx`

- Remove the `user_exercise_progress` query and `progressMap` state.
- Add a new query that computes **current working weight per exercise**:
  - Fetch the most recent workout date per exercise for this user from `sets`.
  - For that workout, compute the **mode weight** across all sets of that exercise (ties → higher weight).
  - Build a `weightMap: Record<string, number>` mapping `exercise_id → working weight`.
- Pass `weightMap` (instead of `progressMap`) to `ExerciseList`.

**Suggested query approach** — single SQL/RPC call or two-step client query:
1. Get the most recent `logged_at` date per exercise:
   ```sql
   select exercise_id, date_trunc('day', max(logged_at)) as last_day
   from sets
   where user_id = $userId
   group by exercise_id
   ```
2. For each exercise, get all sets logged on that day and compute mode (can be done client-side from the result set).

Or collapse into one query by fetching all sets from the user's most recent workout per exercise, then computing mode client-side.

---

### 9. Update `ExerciseList` — replace level display with working weight

**File:** `src/components/exercises/ExerciseList.tsx`

- Change prop `progressMap: Record<string, UserExerciseProgress>` → `weightMap: Record<string, number>`.
- Remove import of `UserExerciseProgress`.
- In `ExerciseRow`:
  - Remove `progress`, `showLevel`, `level` logic.
  - Replace with: look up `weightMap[exercise.id]`. If present, display as `{weight} lbs`; otherwise display `—`.
  - Show `—` for all exercises (including bodyweight and cardio) when no weight data exists.

---

### 10. Update `CreateExerciseModal` — remove level increment field

**File:** `src/components/exercises/CreateExerciseModal.tsx`

- Remove `levelIncrement` state and `showLevelIncrement` logic.
- Remove the "Level increment (lbs)" form section from the JSX.
- Remove `level_increment_lbs` from the `createExercise(...)` call payload.

---

### 11. Update `useExercises` hook — remove `level_increment_lbs` from insert payload

**File:** `src/hooks/useExercises.ts`

- Remove `level_increment_lbs` from the `createExercise` function's insert shape and its parameter type.

---

### 12. Update Supabase generated types

**File:** `src/lib/database.types.ts`

- Remove `level_increment_lbs` from the `exercises` table Row/Insert/Update types.
- Remove `user_exercise_progress` table types entirely.

---

### 13. Update `WorkoutSummaryModal` — remove level-up display

**File:** `src/components/shared/WorkoutSummaryModal.tsx`

- Remove any `levelUps` prop or display of per-exercise level-up results.
- Remove `LevelUpResult` import.

---

## Completion Checklist

- [ ] SQL migration run in Supabase
- [ ] `spec/database-schema.md` updated
- [ ] `Exercise` type cleaned up
- [ ] `UserExerciseProgress` + `LevelUpResult` types deleted
- [ ] `levelUp.ts` deleted
- [ ] `levelUpBridge.ts` deleted
- [ ] `LevelUpOverlay` deleted and removed from `App.tsx`
- [ ] `useExerciseProgress` hook deleted
- [ ] `WorkoutContext` level-up logic removed
- [ ] `ExerciseDetailPage` level card removed
- [ ] `ExercisesPage` uses new working-weight query
- [ ] `ExerciseList` shows working weight instead of level
- [ ] `CreateExerciseModal` level increment field removed
- [ ] `useExercises` hook updated
- [ ] `database.types.ts` updated
- [ ] `WorkoutSummaryModal` level-up section removed
- [ ] App builds with no TypeScript errors
