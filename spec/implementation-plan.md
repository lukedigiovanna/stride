# Stride — Implementation Plan

Each step must reach its benchmark before moving to the next. Steps build on each other — skipping ahead will create untestable, tangled code.

---

## Step 1: Project Foundation

**Goal:** Install all dependencies, configure the design system, define every TypeScript type, and wire up the Supabase client. No UI yet beyond a placeholder — just a rock-solid base that everything else builds on.

### 1.1 Install dependencies

```bash
npm install @supabase/supabase-js react-router-dom framer-motion recharts date-fns
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
```

shadcn init prompts:
- Style: Default
- Base color: pick any (we override it entirely)
- CSS variables: Yes

Install the specific shadcn components Stride needs up front:
```bash
npx shadcn@latest add sheet accordion dialog button input badge progress tabs avatar sonner
```

### 1.2 Configure Tailwind theme

In `src/index.css`, override the CSS variables shadcn generates with the Midnight + Amber palette:

```css
:root {
  --background:        #0F0F14;
  --surface:           #1A1A24;
  --border:            #2A2A38;
  --accent:            #F59E0B;
  --accent-foreground: #0F0F14;
  --text-primary:      #F5F0E8;
  --text-muted:        #7A7A8C;
  --destructive:       #EF4444;
  --xp-start:          #F59E0B;
  --xp-end:            #F97316;
}
```

Map these into `tailwind.config` as named tokens (`bg-surface`, `text-muted`, `border-border`, etc.) so components can use semantic class names rather than raw hex.

### 1.3 Define all TypeScript types

Create `src/types/index.ts`. Every interface mirrors the database schema exactly, using `snake_case` for DB column names. Add a `// DB row` comment on each DB-mirroring interface to distinguish them from view-model types.

```ts
// ─── Enums ───────────────────────────────────────────────────────────────────

export type ExerciseCategory = 'legs' | 'push' | 'pull' | 'core' | 'cardio' | 'misc';

export type EquipmentType =
  | 'dumbbell' | 'barbell' | 'cable'
  | 'bodyweight' | 'machine' | 'other';

export type WeightUnit = 'lbs' | 'kg';

export type DayOfWeek =
  | 'sunday' | 'monday' | 'tuesday' | 'wednesday'
  | 'thursday' | 'friday' | 'saturday';

// ─── DB Row Interfaces ────────────────────────────────────────────────────────

/** DB row — public.profiles */
export interface Profile {
  id: string;
  display_name: string | null;
  weight_unit: WeightUnit;
  total_xp: number;
  bodyweight_reminder_time: string | null;   // HH:MM:SS
  progress_photo_reminder_day: DayOfWeek | null;
  created_at: string;
  updated_at: string;
}

/** DB row — public.exercises */
export interface Exercise {
  id: string;
  user_id: string | null;                    // null = global exercise
  name: string;
  category: ExerciseCategory;
  equipment_type: EquipmentType;
  level_increment_lbs: number | null;        // null for bodyweight/cardio
  created_at: string;
}

/** DB row — public.user_exercise_progress */
export interface UserExerciseProgress {
  id: string;
  user_id: string;
  exercise_id: string;
  current_level: number;
  level_target_weight_lbs: number | null;
  level_target_reps: number;
  level_target_sets: number;
  updated_at: string;
}

/** DB row — public.workouts */
export interface Workout {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;                   // null = workout in progress
  notes: string | null;
  xp_earned: number;
  created_at: string;
}

/** DB row — public.sets */
export interface WorkoutSet {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  weight_lbs: number;                        // distance in miles for cardio
  reps: number;                              // duration in minutes for cardio
  logged_at: string;
  notes: string | null;
}

/** DB row — public.bodyweight_logs */
export interface BodyweightLog {
  id: string;
  user_id: string;
  weight_lbs: number;
  logged_at: string;
  notes: string | null;
}

/** DB row — public.progress_photos */
export interface ProgressPhoto {
  id: string;
  user_id: string;
  storage_path: string;
  taken_on: string;                          // ISO date string YYYY-MM-DD
  notes: string | null;
  uploaded_at: string;
}

// ─── View Model / App-Layer Types ────────────────────────────────────────────

/**
 * An exercise enriched with the current user's progress for that exercise.
 * Used in the exercise list and workout accordion.
 */
export interface ExerciseWithProgress extends Exercise {
  progress: UserExerciseProgress | null;
}

/**
 * A single exercise's sets within an active workout session,
 * grouped for display in the workout accordion.
 */
export interface ActiveExerciseEntry {
  exercise: Exercise;
  sets: WorkoutSet[];
  /** Timestamp of the most recently logged set, for sort order */
  lastLoggedAt: string | null;
}

/**
 * The full state of an in-progress workout, held in WorkoutContext
 * and persisted to localStorage.
 */
export interface ActiveWorkout {
  workoutId: string;
  startedAt: string;
  /** Keyed by exercise ID */
  entries: Record<string, ActiveExerciseEntry>;
}

/**
 * A completed workout with all sets and exercises resolved,
 * used for the History detail view and the post-workout summary.
 */
export interface WorkoutDetail {
  workout: Workout;
  entries: {
    exercise: Exercise;
    sets: WorkoutSet[];
    progressAtTime: UserExerciseProgress | null;
  }[];
  totalVolumeLbs: number;
  totalSets: number;
}

/**
 * Result returned by the level-up check after a workout is saved.
 * Used to trigger celebration UI.
 */
export interface LevelUpResult {
  exercise: Exercise;
  previousLevel: number;
  newLevel: number;
}

/**
 * Gamification state derived from a profile's total_xp.
 * Computed client-side — never stored in the DB.
 */
export interface GamificationState {
  totalXp: number;
  currentLevel: number;
  currentRank: string;
  xpIntoCurrentLevel: number;
  xpRequiredForNextLevel: number;
  nextRank: string | null;
}
```

### 1.4 Initialize Supabase client

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // generated type (see below)

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
```

Generate the Supabase TypeScript types from the live schema (run once, re-run after schema changes):

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

### 1.5 Stub the gamification constants

Create `src/lib/xp.ts` with the full XP thresholds table, rank list, and helper functions. This needs to exist before any component tries to display a level or rank.

```ts
/** Cumulative XP required to reach each level (index = level - 1) */
export const LEVEL_THRESHOLDS: number[] = [
  0, 100, 250, 500, 900, 1_400, 2_000, 2_700, 3_500, 4_500,   // 1–10
  5_700, 7_100, 8_700, 10_500, 12_500, 15_000, 17_800, 21_000, // 11–18
  24_500, 28_500,                                                // 19–20
  // extend as needed
];

export interface Rank {
  minLevel: number;
  title: string;
}

export const RANKS: Rank[] = [
  { minLevel: 1,   title: 'Pipsqueak'  },
  { minLevel: 5,   title: 'Rookie'     },
  { minLevel: 10,  title: 'Amateur'    },
  { minLevel: 20,  title: 'Contender'  },
  { minLevel: 35,  title: 'Lifter'     },
  { minLevel: 50,  title: 'Iron'       },
  { minLevel: 65,  title: 'Beast'      },
  { minLevel: 80,  title: 'Apex'       },
  { minLevel: 100, title: 'Silverback' },
];

/** XP earned for a single strength set */
export const calcStrengthSetXP = (weightLbs: number, reps: number): number =>
  Math.floor((weightLbs * reps) / 10);

/** XP earned for a single cardio set */
export const calcCardioSetXP = (distanceMiles: number, durationMinutes: number): number =>
  Math.floor((distanceMiles * durationMinutes) / 5);

/** Derive the current level from cumulative XP */
export const getLevelFromXP = (totalXp: number): number => {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
};

/** Derive full gamification state from totalXp */
export const getGamificationState = (totalXp: number): GamificationState => { ... };
```

Also create stubs for `src/lib/units.ts` (lbs ↔ kg) and `src/lib/levelUp.ts` (exercise level-up check logic).

### 1.6 Routing skeleton

Set up React Router with placeholder `<div>` pages for every route. The full app shell (bottom nav, workout bar) should already exist as empty components that render their children — so the visual chrome is testable before any real content.

```
/           → HomePage        (placeholder)
/exercises  → ExercisesPage   (placeholder)
/exercises/:id → ExerciseDetailPage (placeholder)
/history    → HistoryPage     (placeholder)
/history/:id → WorkoutDetailPage (placeholder)
/profile    → ProfilePage     (placeholder)
/auth       → AuthPage        (placeholder)
```

Wrap routes in a `<ProtectedRoute>` component that redirects to `/auth` when there is no authenticated session.

### ✅ Step 1 Benchmark

- `npm run dev` starts without errors
- Navigating to each route renders the correct placeholder page
- Navigating to any protected route while signed out redirects to `/auth`
- The Tailwind amber accent color is visible on a test element
- `supabase.auth.getSession()` called from `App.tsx` returns a response (even if null) without throwing
- TypeScript compiles cleanly with `tsc --noEmit`

---

## Step 2: Authentication

**Goal:** Users can sign up, sign in, and sign out. A `AuthContext` provides the current user everywhere in the app. Supabase handles the session automatically.

### 2.1 AuthContext

Create `src/context/AuthContext.tsx`. It wraps `supabase.auth.onAuthStateChange` and exposes:

```ts
interface AuthContextValue {
  /** null while loading, null after confirmed signed-out */
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}
```

`profile` is fetched immediately after `user` is set. The context holds both so that any component can read profile settings (weight unit, display name) without a separate query.

### 2.2 Auth screens

`src/pages/AuthPage.tsx` — toggles between Sign In and Sign Up views. Both use the same page shell; only the form fields change.

**Sign In fields:** Email, Password, Submit button, "Don't have an account? Sign up" toggle
**Sign Up fields:** Display name, Email, Password, Submit button, "Already have an account? Sign in" toggle

On sign-up success, Supabase triggers the `handle_new_user` DB trigger which creates the `profiles` row automatically.

Show inline error messages (not alerts) for: invalid credentials, email already taken, weak password.

### 2.3 ProtectedRoute

```tsx
// src/components/layout/ProtectedRoute.tsx
// Renders children if authenticated, redirects to /auth otherwise.
// Shows a full-screen loading spinner while isLoading is true.
```

### ✅ Step 2 Benchmark

- Visiting the app while signed out lands on `/auth`
- Signing up with a new email creates the user and a `profiles` row in Supabase (verify in dashboard)
- Signing in navigates to `/` (home placeholder)
- Signing out returns to `/auth`
- Refreshing the page while signed in stays on the current route (session persists)
- Auth errors (wrong password, duplicate email) show readable inline messages

---

## Step 3: Data Layer — Hooks and WorkoutContext

**Goal:** Every piece of server state has a typed custom hook. The `WorkoutContext` is fully implemented including localStorage persistence. No UI consumes these yet — they just need to work and be testable in isolation.

### 3.1 Custom hooks

Each hook follows the same pattern: fetch on mount, expose data + loading + error, and a mutate function where applicable.

```
src/hooks/
  useProfile.ts          — read/update the current user's profile row
  useExercises.ts        — list exercises (global + user-created), create exercise
  useExerciseProgress.ts — read/upsert UserExerciseProgress for a given exercise
  useWorkouts.ts         — list completed workouts, paginated
  useWorkoutDetail.ts    — fetch one workout with all sets joined
  useSets.ts             — CRUD for sets within a workout
  useBodyweightLogs.ts   — list logs, insert log, compute 7-day average
  useProgressPhotos.ts   — list photos, upload photo (Supabase Storage), delete
```

All return values must be fully typed. No `any`. Example signature:

```ts
// useBodyweightLogs.ts
interface UseBodyweightLogsReturn {
  logs: BodyweightLog[];
  sevenDayAvgLbs: number | null;
  isLoading: boolean;
  error: string | null;
  logWeight: (weightLbs: number, notes?: string) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
}
```

### 3.2 WorkoutContext

`src/context/WorkoutContext.tsx` — the most critical piece of global state.

```ts
interface WorkoutContextValue {
  // ── State ──
  activeWorkout: ActiveWorkout | null;
  isWorkoutActive: boolean;

  // ── Workout lifecycle ──
  startWorkout: () => Promise<void>;
  finishWorkout: () => Promise<FinishWorkoutResult>;
  discardWorkout: () => Promise<void>;

  // ── Set management ──
  logSet: (exerciseId: string, weightLbs: number, reps: number, notes?: string) => Promise<void>;
  updateSet: (setId: string, weightLbs: number, reps: number) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;

  // ── Rest timer ──
  restTimer: RestTimerState;
  startRestTimer: () => void;
  resetRestTimer: () => void;
  stopRestTimer: () => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  setRestDuration: (seconds: number) => void;
}

interface RestTimerState {
  isActive: boolean;
  secondsRemaining: number;
  durationSeconds: number;
}

interface FinishWorkoutResult {
  xpEarned: number;
  levelUps: LevelUpResult[];
  previousTotalXp: number;
  newTotalXp: number;
}
```

**Persistence:** On every state change, serialize `activeWorkout` to `localStorage` under the key `stride_active_workout`. On mount, attempt to hydrate from localStorage. If a workout row exists in the DB with `ended_at = null` for the current user, use that as the source of truth and reconcile with localStorage.

**`finishWorkout` logic (runs in sequence):**
1. For each set, calculate XP using `calcStrengthSetXP` or `calcCardioSetXP`
2. Write `xp_earned` and `ended_at` to the `workouts` row
3. Increment `profiles.total_xp` by the earned amount
4. Run the level-up check (`src/lib/levelUp.ts`) for each exercise worked
5. Upsert `user_exercise_progress` rows for any level-ups
6. Clear `activeWorkout` from state and localStorage
7. Return `FinishWorkoutResult`

### 3.3 Level-up check logic

`src/lib/levelUp.ts` — pure function, no side effects, fully unit-testable:

```ts
/**
 * Given the sets logged for an exercise and the user's current progress,
 * determine if the user has hit the level target and should advance.
 * Returns the new progress state, or null if no level-up occurred.
 */
export const checkLevelUp = (
  sets: WorkoutSet[],
  progress: UserExerciseProgress,
  exercise: Exercise,
): UserExerciseProgress | null => { ... }
```

The check: count sets where `weight_lbs >= level_target_weight_lbs` AND `reps >= level_target_reps`. If count `>= level_target_sets`, level up. New target weight = `level_target_weight_lbs + exercise.level_increment_lbs`.

### ✅ Step 3 Benchmark

- `useExercises()` in a test component returns the seeded global exercises list
- `useProfile()` returns the current user's profile with correct defaults
- Starting a workout via `WorkoutContext.startWorkout()` creates a `workouts` row in Supabase with `ended_at = null`
- Refreshing the page while a workout is active restores the `activeWorkout` from localStorage
- Logging a set via `WorkoutContext.logSet()` creates a `sets` row in Supabase
- `finishWorkout()` sets `ended_at`, writes `xp_earned`, and increments `profiles.total_xp`
- `checkLevelUp()` returns the correct result for a variety of test inputs (test manually in a scratch component or browser console)

---

## Step 4: App Shell and Navigation

**Goal:** The full navigational chrome is in place — bottom tab bar, route transitions, and the workout bar stub. Every page renders within the correct layout from this point forward.

### 4.1 Root layout

`src/components/layout/AppLayout.tsx` — wraps the page content area and renders:
- `<BottomNav />` fixed at the bottom
- `<WorkoutBar />` just above the nav, only when `isWorkoutActive` is true
- A scrollable content area between the top of the viewport and the nav/bar

The content area's bottom padding must account for the combined height of the bottom nav and (when active) the workout bar, so content is never obscured on mobile.

### 4.2 BottomNav

`src/components/layout/BottomNav.tsx`

Four tabs: Home, Exercises, History, Profile. Each tab is a `<Link>` with an icon (use `lucide-react` icons) and a label. The active tab gets the amber accent color; inactive tabs use `text-muted`.

Icons:
- Home → `Home`
- Exercises → `Dumbbell`
- History → `ClockHistory` / `History`
- Profile → `User`

The nav is `fixed bottom-0`, full width, with a subtle top border. Height: 64px. Safe area inset padding for iPhone notch: `pb-[env(safe-area-inset-bottom)]`.

### 4.3 WorkoutBar (collapsed state only)

`src/components/layout/WorkoutBar.tsx`

For now, render the collapsed strip:
```
[ 💪 Workout in progress  |  0:42:15  |  3,240 lbs  ↑ ]
```
- The elapsed time ticks live using a `useEffect` interval that reads `activeWorkout.startedAt`
- Volume is computed from `activeWorkout.entries` as `SUM(weight_lbs * reps)` for strength sets, treating cardio as distance only
- Tapping the bar opens the workout sheet (wired up in Step 6)

### ✅ Step 4 Benchmark

- All four tabs navigate correctly between their placeholder pages
- The active tab icon and label are highlighted in amber
- Navigating between tabs does not lose the active workout state
- When a workout is active, the workout bar appears above the bottom nav
- The elapsed time on the workout bar updates every second
- On an iPhone (or Safari DevTools device simulation), the bottom nav clears the home indicator bar

---

## Step 5: Home Screen

**Goal:** The Home tab is fully built for the idle state. Users can see their stats at a glance, review recent workouts, and log their bodyweight.

### 5.1 User summary card

`src/components/home/UserSummaryCard.tsx`

Displays:
- Display name
- Current rank title (derived from `profile.total_xp` via `getGamificationState()`)
- Global level number
- `XPBar` component (Step 11 will animate it; for now render it as a static progress bar)

### 5.2 Quick stats strip

`src/components/home/QuickStats.tsx`

Three tiles side-by-side:
- **Workouts** — count of rows in `workouts` where `ended_at IS NOT NULL`
- **This week** — total volume logged in the current calendar week (Mon–Sun), in the user's preferred unit
- **Streak** — consecutive calendar days with at least one completed workout (computed in `date-fns`)

### 5.3 Recent activity

`src/components/home/RecentActivity.tsx`

Last 3 completed workouts as compact cards (uses `useWorkouts`). Each card shows:
- Formatted date (e.g., "Monday, Mar 9")
- Duration
- XP earned
- Total volume
- A "View all" link at the bottom navigates to `/history`

### 5.4 Log Weight modal

`src/components/home/LogWeightModal.tsx`

A shadcn `<Dialog>`. Single numeric input for weight. Unit label derived from `profile.weight_unit`. On submit, calls `useBodyweightLogs().logWeight()` with the value converted to lbs if needed.

### 5.5 Active workout banner

When `isWorkoutActive`, replace the "Start Workout" button with a dimmed banner:
```
Workout in progress — tap the bar above to return
```

### ✅ Step 5 Benchmark

- Home screen shows the user's display name, rank, level, and XP bar
- All three quick stat tiles show correct values (verify against Supabase dashboard)
- Recent activity shows the last 3 completed workouts
- Tapping "Log Weight" opens the modal; submitting creates a `bodyweight_logs` row in Supabase
- The "Start Workout" button is replaced by the banner when a workout is active
- The XP bar's fill proportion is correct relative to the level thresholds

---

## Step 6: Active Workout — Core Logging

**Goal:** The workout sheet is fully functional. Users can start a workout, navigate exercises by category, log sets for all three exercise types (strength, bodyweight, cardio), and edit or delete sets.

### 6.1 WorkoutSheet

`src/components/workout/WorkoutSheet.tsx`

A shadcn `<Sheet side="bottom">` that opens to ~85% screen height when triggered by tapping `<WorkoutBar>`. The sheet does not close by tapping the backdrop — it only closes via the collapse handle or "Finish Workout".

Structure:
- Drag handle at top
- Sticky header (elapsed time, volume, "Finish Workout" button)
- Rest timer row (Step 7)
- Scrollable body: ExerciseAccordion + "Add Exercise" button

### 6.2 ExerciseAccordion

`src/components/workout/ExerciseAccordion.tsx`

Uses shadcn `<Accordion type="single" collapsible>`. One item per category (Legs, Push, Pull, Core, Cardio, Misc).

Each category header shows:
- Category icon (lucide)
- Category name
- Badge with count of exercises worked in this session (amber, only if > 0)

Inside an expanded category, exercises are listed in order:
1. Exercises with sets logged in this session (sorted by most recent `lastLoggedAt` descending)
2. All other exercises in the category (alphabetical)

Exercises not yet worked in this session appear as simple tappable rows. Tapping them expands them in place to show the set logging UI.

### 6.3 SetLogger

`src/components/workout/SetLogger.tsx`

The inline set entry UI rendered within an expanded exercise card. Adapts based on exercise type:

**Strength:**
- Weight input (numeric, pre-fills from last set or most recent historical set)
- Reps input (numeric, pre-fills from last set)
- "Log Set" button

**Bodyweight:**
- Weight input (pre-fills from `useBodyweightLogs().sevenDayAvgLbs`, or blank)
- Reps input
- "Log Set" button
- Small `(?)` hint: "Using your 7-day avg bodyweight"

**Cardio:**
- Distance input with unit label (mi or km)
- Duration input (minutes)
- "Log Set" button

On submit, calls `WorkoutContext.logSet()`. The new set appears immediately in the list above the input fields (optimistic update from WorkoutContext state, not a refetch).

### 6.4 SetRow

`src/components/workout/SetRow.tsx`

Displays a logged set within the exercise card. Shows set number, weight/reps (or distance/duration for cardio).

- **Delete:** tap a trash icon → `WorkoutContext.deleteSet()`
- **Edit:** tap to enter edit mode — the row becomes inline editable fields; confirm to `WorkoutContext.updateSet()`

### 6.5 Add Exercise modal

At the bottom of the accordion, "+ Add Exercise" opens a `<Dialog>` with a searchable list of all exercises (global + user-created), filtered by category chips. Tapping an exercise closes the dialog and expands it in the accordion.

### ✅ Step 6 Benchmark

- Tapping "Start Workout" on the home screen creates a workout row and opens the sheet
- The workout bar is visible on all tabs while the sheet is collapsed
- Tapping the workout bar re-opens the sheet
- Each category in the accordion expands and collapses correctly; only one is open at a time
- Logging a set for a strength, bodyweight, and cardio exercise each creates a `sets` row in Supabase with correct values
- Bodyweight exercise pre-fills with the 7-day avg (or blank if none)
- Editing a set updates the Supabase row; deleting a set removes the row
- The volume in the workout bar header updates after each set is logged

---

## Step 7: Active Workout — Rest Timer and Finish Flow

**Goal:** The rest timer works as specified. Finishing a workout runs the full close-out sequence, shows the summary, and leaves the app in the correct post-workout state.

### 7.1 RestTimer component

`src/components/workout/RestTimer.tsx`

Renders beneath the workout sheet header. Uses `WorkoutContext.restTimer` state.

**Idle state (timer not running):**
```
[ Start Rest ]   [  90s  ▼  ▲ ]
```
The stepper adjusts `restDuration` in 15s increments.

**Active state:**
```
01:27   [ +30s ]   [ Reset ]   [ Stop ]
```
Large countdown display. When `secondsRemaining` hits 0: call `navigator.vibrate([200, 100, 200])`, briefly flash the workout bar amber.

### 7.2 Finish Workout flow

Tapping "Finish Workout" in the sheet header opens a confirmation `<Dialog>`:
```
Finish workout?
You've logged 9 sets across 3 exercises.
[ Cancel ]  [ Finish ]
```

On confirm, calls `WorkoutContext.finishWorkout()`. While the async operation runs, show a loading spinner. On completion, close the sheet and the dialog, then show `<WorkoutSummaryModal>`.

### 7.3 WorkoutSummaryModal

`src/components/shared/WorkoutSummaryModal.tsx`

Full-screen modal (not a bottom sheet) that appears after a workout finishes.

Sections:
- Header: "Workout Complete" + duration + date
- Stats row: Volume | Sets | XP Earned
- Exercise breakdown table: exercise name → sets logged → volume
- Level-up callouts: for each `LevelUpResult` in the finish result, show a highlighted row "Exercise Name → Level N" with an amber badge
- "Done" button: dismisses modal, navigates to home

If the global level increased (detected by comparing `previousTotalXp` and `newTotalXp` level thresholds), the level-up overlay fires first (Step 11), then the summary modal shows afterward.

### ✅ Step 7 Benchmark

- "Start Rest" starts the countdown; "Reset" restarts it; "Stop" clears it
- Adjusting the duration stepper changes the duration the timer resets to
- When the timer hits 0, the device vibrates and the workout bar flashes
- "Finish Workout" confirmation dialog appears with the correct set/exercise counts
- After finishing, the workout summary modal shows the correct XP, volume, and duration
- The `workouts` row in Supabase has `ended_at` and `xp_earned` set correctly
- `profiles.total_xp` is incremented by the correct amount
- No active workout bar appears after the workout is finished
- If an exercise leveled up, it is called out in the summary

---

## Step 8: Exercises Tab

**Goal:** Users can browse and search all exercises, view per-exercise history and level progress, and create new custom exercises.

### 8.1 Exercise list

`src/pages/ExercisesPage.tsx` + `src/components/exercises/ExerciseList.tsx`

- Segment control (scrollable horizontal tabs on mobile): All | Legs | Push | Pull | Core | Cardio | Misc
- Search bar below: filters by name (client-side filter on the loaded list)
- Each row: exercise name, category badge, current level (or "—" for cardio), chevron
- User-created exercises get a small "Custom" badge
- FAB: "+ New Exercise" (bottom right)

### 8.2 Create Exercise modal

`src/components/exercises/CreateExerciseModal.tsx`

Fields:
- Name (text input, required)
- Category (select)
- Equipment type (select)
- Level increment (numeric input, only shown if equipment type is not `bodyweight` and category is not `cardio`)

On submit, calls `useExercises().createExercise()`. The new exercise immediately appears in the list.

### 8.3 Exercise detail

`src/pages/ExerciseDetailPage.tsx`

Fetches the exercise + user's progress + all sets for that exercise.

**Strength / bodyweight exercises:**
- Level card: current level, target description ("3 × 12 @ 25 lbs"), progress bar showing qualifying sets completed this target
- Volume over time chart (Recharts `BarChart`): x = date, y = volume (lbs). Time range toggle: 1M / 3M / 6M / All
- Max weight over time chart (Recharts `LineChart`): x = date, y = max weight used in that session
- Set history: grouped by workout date, shows all sets in that session

**Cardio exercises:**
- No level card
- Distance over time (line chart)
- Duration over time (line chart)
- Session history table

Charts use amber as the line/bar color. Axes use `text-muted` color.

### ✅ Step 8 Benchmark

- Exercise list loads and shows all seeded global exercises
- Category filter correctly shows only exercises in that category
- Search filters the list in real time
- Creating a new exercise saves it and shows it in the list with a "Custom" badge
- Navigating to an exercise detail shows the correct current level and target
- Charts render with real data from logged sets (may be sparse at this point, which is fine)
- The progress bar on the level card reflects the correct number of qualifying sets

---

## Step 9: History Tab

**Goal:** Users can review past workouts, drill into the detail, and edit or delete any set or workout.

### 9.1 Workout list

`src/pages/HistoryPage.tsx` + `src/components/history/WorkoutCard.tsx`

- Paginated list (load 20 at a time, "Load more" at bottom)
- Each card: date, weekday, duration, categories worked (derived from the sets), total volume, XP earned
- Tap → WorkoutDetailPage

### 9.2 Workout detail

`src/pages/WorkoutDetailPage.tsx`

Fetches `WorkoutDetail` via `useWorkoutDetail(workoutId)`.

Layout:
- Header: date, duration, XP, total volume
- Per-exercise sections:
  - Exercise name + level at time of workout
  - Each set as a row: set number, weight × reps (or distance · duration for cardio)
  - Swipe-to-delete on mobile (or a visible delete icon on desktop) — calls `useSets().deleteSet()`
  - Tap a set row to edit it inline
- Editable notes field for the workout (textarea, auto-saves on blur)
- "Delete Workout" button at the bottom (red, with confirmation dialog)

**Important:** Deleting a set must subtract that set's XP from `profiles.total_xp` to keep it consistent. Deleting a whole workout subtracts `workout.xp_earned`.

### ✅ Step 9 Benchmark

- History list shows all completed workouts, newest first
- Each card shows correct duration, volume, and XP values
- Tapping a card navigates to the detail view with the correct data
- Editing a set value updates the Supabase row
- Deleting a set removes the row and the set disappears from the view
- Deleting a workout removes it from the history list and the `workouts` row is gone in Supabase
- After deleting a set, `profiles.total_xp` is decremented correctly (verify in Supabase dashboard)
- Workout notes save correctly and persist on refresh

---

## Step 10: Profile Tab

**Goal:** The Profile tab is complete. Users can view their rank, lifetime stats, bodyweight history, progress photos, and manage all settings.

### 10.1 Rank card

`src/components/profile/RankCard.tsx`

- Display name (editable inline with a pencil icon tap)
- Rank title (large, amber)
- "Level N" label
- XP bar: `xpIntoCurrentLevel / xpRequiredForNextLevel`
- "X XP to [next rank]" label beneath the bar (or "Max rank reached" if at top)

### 10.2 Lifetime stats

Four stat tiles: Total Volume | Total Sets | Total Workouts | Best Streak. All computed from `useWorkouts()` + `useSets()` results or a dedicated Supabase aggregate query.

### 10.3 Bodyweight section

`src/components/profile/BodyweightSection.tsx`

- Latest logged weight + how long ago (e.g., "175 lbs · 2 days ago")
- Mini line chart (Recharts `LineChart`, last 30 entries)
- "Log Weight" button (same modal as Home)
- Displays in the user's preferred unit

### 10.4 Progress photos

`src/components/profile/ProgressPhotos.tsx`

- CSS grid of thumbnails (3 per row), newest first
- Tap any thumbnail → full-screen lightbox (a `<Dialog>` with the full image + date + notes)
- "Add Photo" button → opens device file picker (`<input type="file" accept="image/*" capture="environment">`)
- On upload: resize to max 2MB client-side before uploading to Supabase Storage, insert a `progress_photos` row

### 10.5 Settings

Rendered as a simple list of rows beneath the photos section:

- **Weight unit** — segmented toggle: lbs / kg. Updates `profile.weight_unit`.
- **Rest timer default** — number input (seconds). Synced to `WorkoutContext.restTimer.durationSeconds` and saved to `profile` (add a `rest_timer_default_seconds` column to the DB or store in localStorage).
- **Bodyweight reminder** — time picker (HTML `<input type="time">`). Null = disabled.
- **Progress photo reminder** — day-of-week select. Null = disabled.
- **Sign out** — calls `supabase.auth.signOut()`.

### ✅ Step 10 Benchmark

- Rank card shows the correct rank, level, and XP bar fill
- Display name can be edited inline and saves to Supabase
- Lifetime stats tiles show correct aggregate values
- Bodyweight chart renders with logged data
- Uploading a progress photo creates a `progress_photos` row and the image appears in the grid
- Tapping a thumbnail opens the full-size image
- Changing weight unit immediately reflects the new unit everywhere in the app
- Sign out works and returns to `/auth`

---

## Step 11: Gamification — Level-Up Celebrations

**Goal:** Leveling up feels rewarding. Exercise level-ups show an inline toast. Global level-ups show a full-screen moment. The XP bar animates. Everything is polished.

### 11.1 XPBar animation

`src/components/shared/XPBar.tsx`

Use Framer Motion `<motion.div>` to animate the fill width whenever `xpIntoCurrentLevel` changes. Ease: spring, moderate stiffness. Color: amber-to-orange gradient.

### 11.2 Exercise level-up toast

After `WorkoutContext.finishWorkout()` returns, iterate over `levelUps` and fire one `sonner` toast per level-up:

```
🏋️ Dumbbell Bench Press → Level 5
```

Toasts appear from the top of the screen (above the workout bar area) with amber accent styling. They are non-blocking and auto-dismiss after 4 seconds.

### 11.3 Global level-up overlay

`src/components/shared/LevelUpOverlay.tsx`

A full-screen Framer Motion overlay that fires when the user's global level increases. Triggered in `App.tsx` by comparing the previous and current level derived from `profile.total_xp`.

Sequence:
1. Overlay fades in with a dark background
2. "LEVEL UP" text scales in from center
3. New level number and new rank title slide up
4. If a new rank was unlocked, the rank title pulses amber
5. "Keep going" tap-to-dismiss button fades in after the animation

### 11.4 Exercise level card progress

In the Exercise Detail view, the progress bar beneath the level target should animate fill on mount using Framer Motion. Shows qualifying sets logged against the target set count (e.g., 2/3 matching sets).

### ✅ Step 11 Benchmark

- Finish a workout where an exercise hit its target — a toast fires with the exercise name and new level
- `user_exercise_progress` row has its `current_level` incremented and new targets set
- XP bar in the home summary card and profile tab animates smoothly when XP changes
- Manually trigger a global level-up (temporarily lower XP threshold) — the full-screen overlay fires and can be dismissed
- If a new rank is unlocked, the rank title is shown in the overlay
- After the overlay dismisses, the workout summary modal appears correctly

---

## Step 12: PWA Polish and Notifications

**Goal:** The app installs cleanly to the iOS home screen, push notifications work where supported, and the app behaves correctly on poor or no connectivity.

### 12.1 Verify PWA manifest and service worker

The Vite PWA plugin (`vite-plugin-pwa`) was included in the boilerplate. Confirm and tune:

- `manifest.json`: name, short_name, theme_color (`#0F0F14`), background_color (`#0F0F14`), display: `standalone`, icons (192 and 512 variants already in `public/`)
- Service worker strategy: `GenerateSW` with `networkFirst` for API calls, `cacheFirst` for static assets
- Ensure the app shell (HTML + JS) is pre-cached so the app loads from cache when offline

### 12.2 Push notification setup

Request notification permission lazily — only when the user enables a reminder in Profile settings, not on first load.

```ts
// src/lib/notifications.ts

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const scheduleBodyweightReminder = (timeString: string): void => { ... };
export const scheduleProgressPhotoReminder = (dayOfWeek: DayOfWeek): void => { ... };
```

Reminders are implemented as **scheduled local notifications** via the service worker's `setTimeout`/`setInterval` approach, with a fallback note that push notifications via a server require the app to be installed to the home screen on iOS. For now, use `self.registration.showNotification()` from the service worker.

### 12.3 Offline handling

- If Supabase queries fail due to network loss, hooks should catch the error and show a non-blocking `sonner` toast: "You're offline — changes will sync when reconnected."
- The active workout in `WorkoutContext` writes to localStorage on every set. If a network call to Supabase fails while logging a set, queue the write and retry on reconnect using `navigator.onLine` event listeners.
- Read-only data (exercise list, profile) can show stale cached data from a previous load.

### 12.4 Mobile UX hardening

- Prevent double-tap zoom on buttons: `touch-action: manipulation` via Tailwind
- Numeric inputs on iOS show the numeric keypad: `inputMode="decimal"` for weight/distance, `inputMode="numeric"` for reps/duration
- The virtual keyboard pushing layout: use `dvh` (dynamic viewport height) units on the app shell instead of `100vh` so the layout doesn't break when the keyboard appears
- Ensure the workout sheet scroll area is independently scrollable inside the bottom sheet (overflow-y: auto on the inner content div, not on the sheet root)

### ✅ Step 12 Benchmark

- On Chrome desktop: Lighthouse PWA audit scores 100 (or near it)
- On an iPhone with the app added to home screen: app launches in standalone mode (no browser chrome)
- Enabling the bodyweight reminder in Profile and then opening the app without logging weight by the set time triggers a notification on iOS (must be on home screen) and Android
- Turning airplane mode on mid-workout and logging a set shows the offline toast; re-enabling network syncs the queued set to Supabase
- Numeric inputs on iOS show the correct keyboard type (number pad, not full keyboard)
- The layout does not shift or break when the virtual keyboard opens during set logging

---

## Build Order Summary

| Step | What Gets Built | Unlocks |
|---|---|---|
| 1 | Deps, types, Supabase client, routing skeleton, XP constants | Everything |
| 2 | Auth screens, AuthContext, ProtectedRoute | Signed-in app |
| 3 | All data hooks, WorkoutContext, level-up logic | All features |
| 4 | AppLayout, BottomNav, WorkoutBar (collapsed) | Navigable app shell |
| 5 | Home screen (idle), log weight modal | Dashboard |
| 6 | WorkoutSheet, accordion, set logging, add exercise | Core workout loop |
| 7 | Rest timer, finish workout, summary modal | Complete workout lifecycle |
| 8 | Exercises list, detail, create exercise | Exercise management |
| 9 | History list, workout detail, edit/delete | Data review and correction |
| 10 | Profile tab, settings, progress photos | User preferences and media |
| 11 | XP bar animation, toasts, level-up overlay | Gamification feel |
| 12 | PWA manifest, notifications, offline handling | Installable, production-ready |
