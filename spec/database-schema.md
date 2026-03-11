# Stride — Database Schema

## Platform: Supabase

Stride uses [Supabase](https://supabase.com) as its backend, which provides:
- **PostgreSQL** — the underlying relational database
- **Auth** — built-in user authentication (email/password + OAuth)
- **Row Level Security (RLS)** — enforces that users can only access their own data at the database level, not just the application level
- **Storage** — used for progress photo uploads
- **Realtime** — available for future live-sync features (stretch goal)

All tables live in the default `public` schema unless otherwise noted. Every user-owned table includes a `user_id` column referencing `auth.users(id)` and is protected by RLS policies.

---

## Tables

### `profiles`
Extends Supabase's built-in `auth.users` with app-specific user data. Created automatically when a user signs up via a database trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, references `auth.users(id)` |
| `display_name` | `text` | User's chosen name |
| `weight_unit` | `text` | `'lbs'` or `'kg'`, default `'lbs'` |
| `total_xp` | `integer` | Cumulative XP across all time, default `0` |
| `bodyweight_reminder_time` | `time` | Time of day to send bodyweight reminder, nullable |
| `progress_photo_reminder_day` | `text` | Day of week (e.g., `'sunday'`), nullable |
| `created_at` | `timestamptz` | Auto-set on insert |
| `updated_at` | `timestamptz` | Auto-updated on change |

**Notes:** `total_xp` is updated incrementally whenever sets are logged or deleted. It is derived data, but stored directly for performance so the user's level/rank can be read instantly without aggregating all historical sets.

---

### `exercises`
The full catalog of exercises available to a user. Includes both a set of **global/default exercises** (shared, `user_id = null`) and **user-created exercises** (`user_id` set to the owner).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | References `auth.users(id)`, nullable (null = global) |
| `name` | `text` | e.g., `'Dumbbell Bench Press'` |
| `category` | `text` | Enum: `'legs'`, `'push'`, `'pull'`, `'core'`, `'cardio'`, `'misc'` |
| `equipment_type` | `text` | `'dumbbell'`, `'barbell'`, `'cable'`, `'bodyweight'`, `'machine'`, `'other'` |
| `level_increment_lbs` | `numeric` | Weight increment per exercise level (e.g., `5` for dumbbells). Nullable for bodyweight/cardio. |
| `created_at` | `timestamptz` | Auto-set on insert |

**RLS:** Users can read global exercises (`user_id IS NULL`) and their own exercises. Users can only insert/update/delete exercises they own.

---

### `user_exercise_progress`
Tracks each user's current level for each exercise they have engaged with.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | References `auth.users(id)` |
| `exercise_id` | `uuid` | References `exercises(id)` |
| `current_level` | `integer` | Current exercise level, starts at `1` |
| `level_target_weight_lbs` | `numeric` | Weight target for current level |
| `level_target_reps` | `integer` | Rep target for current level |
| `level_target_sets` | `integer` | Set count target for current level, typically `3` |
| `updated_at` | `timestamptz` | When the level was last changed |

**Unique constraint:** `(user_id, exercise_id)` — one row per user per exercise.

**Notes:** When a user first logs a set for an exercise, a row is created at level 1 with the appropriate starting targets. Level-up logic runs in the application layer after each workout is saved.

---

### `workouts`
Represents a single training session. A workout is started when the user begins logging and ended when they explicitly finish or after a period of inactivity.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | References `auth.users(id)` |
| `started_at` | `timestamptz` | When the session began |
| `ended_at` | `timestamptz` | When the session was finished, nullable (null = in progress) |
| `notes` | `text` | Optional free-text note for the session, nullable |
| `xp_earned` | `integer` | Total XP earned during this workout, computed on finish |
| `created_at` | `timestamptz` | Auto-set on insert |

**Notes:** `ended_at = null` means the workout is active. Only one workout per user should have `ended_at = null` at a time (enforced in application logic). `xp_earned` is computed and written when the session is closed.

---

### `sets`
The core logging table. Every logged set is a row here.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | References `auth.users(id)` |
| `workout_id` | `uuid` | References `workouts(id)` |
| `exercise_id` | `uuid` | References `exercises(id)` |
| `set_number` | `integer` | Order within the exercise for this workout (1, 2, 3…) |
| `weight_lbs` | `numeric` | Weight used, stored in lbs internally regardless of user preference |
| `reps` | `integer` | Reps completed |
| `logged_at` | `timestamptz` | Exact timestamp when the set was logged, auto-set |
| `notes` | `text` | Optional per-set note (e.g., "felt easy"), nullable |

**Notes:** Weight is always stored in lbs internally. Conversion to/from kg happens in the application layer based on `profiles.weight_unit`. This avoids unit ambiguity in the database.

**Indexes:**
- `(user_id, exercise_id, logged_at)` — for fetching exercise history
- `(user_id, workout_id)` — for fetching all sets in a workout
- `(user_id, logged_at)` — for volume-over-time queries

---

### `bodyweight_logs`
One row per bodyweight entry.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | References `auth.users(id)` |
| `weight_lbs` | `numeric` | Stored in lbs internally |
| `logged_at` | `timestamptz` | When the weight was entered, default `now()` |
| `notes` | `text` | Optional note, nullable |

**Index:** `(user_id, logged_at)` — for charting over time.

---

### `progress_photos`
Metadata for progress photos. The actual image files are stored in Supabase Storage.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | References `auth.users(id)` |
| `storage_path` | `text` | Path within the Supabase Storage bucket (e.g., `{user_id}/2025-03-09.jpg`) |
| `taken_on` | `date` | The date the photo represents (may differ from upload date) |
| `notes` | `text` | Optional note, nullable |
| `uploaded_at` | `timestamptz` | When the photo was uploaded, auto-set |

**Storage bucket:** `progress-photos`, with RLS-equivalent policies so users can only access their own folder (`{user_id}/`).

---

## Derived / Computed Data

These values are never stored as standalone tables but are computed on read or maintained as denormalized counters:

| Derived Value | Source | Strategy |
|---|---|---|
| User global level | `profiles.total_xp` | Computed client-side from XP thresholds table |
| User rank title | `profiles.total_xp` | Mapped from level using static rank table |
| Workout total volume | `sets` | Aggregated: `SUM(weight_lbs * reps)` for sets in a workout |
| Exercise volume over time | `sets` | Grouped by date or workout |
| Exercise level-up check | `sets` + `user_exercise_progress` | Checked after each workout save in application logic |

---

## Row Level Security Summary

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | Own row | Via trigger only | Own row | No |
| `exercises` | Own + global | Own | Own | Own |
| `user_exercise_progress` | Own | Own | Own | Own |
| `workouts` | Own | Own | Own | Own |
| `sets` | Own | Own | Own | Own |
| `bodyweight_logs` | Own | Own | Own | Own |
| `progress_photos` | Own | Own | Own | Own |

All RLS policies use `auth.uid() = user_id` as the condition.

---

## Supabase Storage

**Bucket:** `progress-photos`
**Access:** Private (not public). Files are accessed via signed URLs generated server-side or via Supabase client with the authenticated user's session.
**Path convention:** `{user_id}/{photo_id}.{ext}`

---

## Implementation Notes

- **No edge functions required at launch** — all logic (level-up checks, XP calculation, unit conversion) runs in the application layer on the client. Edge functions can be added later if server-side validation becomes necessary.
- **XP calculation** — `xp_earned` per set = `floor(weight_lbs * reps / 10)`. This formula can be tuned. It rewards heavier volume without making XP numbers feel absurd.
- **Level-up logic** — after a workout is saved, the app checks each exercise worked: if the user logged `≥ level_target_sets` sets at `≥ level_target_weight_lbs` for `≥ level_target_reps` reps, the exercise levels up. The new level's targets are computed from the current weight + `level_increment_lbs`.
- **Migrations** — managed with Supabase CLI (`supabase db push`) and version-controlled SQL migration files in `supabase/migrations/`.
