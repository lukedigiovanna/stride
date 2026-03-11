# Stride — UI Spec

## Confirmed Decisions

### A: CSS / Component Framework — Tailwind CSS + shadcn/ui

Tailwind handles all styling via utility classes. shadcn/ui is not a traditional component library — it's a collection of copy-paste components built on Radix UI primitives that live directly in your codebase (`src/components/ui/`). You own and can modify every component.

Radix provides rock-solid behavior for the exact patterns Stride needs heavily: modals, bottom sheets, accordions, and toasts — including focus trapping and accessibility that would be expensive to hand-roll. The visual output is fully custom with no imposed design language.

---

### B: Color Theme — Midnight + Amber

| Role | Color | Hex |
|---|---|---|
| Background | Deep navy-black | `#0F0F14` |
| Surface (cards) | Dark navy | `#1A1A24` |
| Border | Subtle indigo-grey | `#2A2A38` |
| Primary accent | Warm amber | `#F59E0B` |
| Text primary | Warm white | `#F5F0E8` |
| Text muted | Cool grey | `#7A7A8C` |
| Destructive | Red-orange | `#EF4444` |
| XP / progress | Amber-to-orange | `#F59E0B → #F97316` |

Dark base is optimal for gym use on OLED screens. Amber reads as fire and achievement — warm, motivating, and easy on the eyes in any lighting.

---

## Navigation Structure

Four bottom tabs. The bottom tab bar is fixed and always visible (except when a keyboard is open on mobile).

```
[ Home ]  [ Workout ]  [ Exercises ]  [ History ]  [ Profile ]
```

Wait — that's five. The **Workout** tab only makes sense when a session is active, and it shouldn't clutter nav when it's not. Instead:

```
[ Home ]  [ Exercises ]  [ History ]  [ Profile ]
```

When a workout is active, a **persistent workout bar** appears above the tab bar. Tapping it expands the full workout view as a bottom sheet that slides up over the current tab. This keeps the workout session always one tap away without forcing a dedicated tab.

---

## Screen Inventory

### 1. Auth Screens
- **Sign In** — email + password, link to sign up
- **Sign Up** — display name, email, password
- Both are full-screen, minimal, centered forms. No decorative chrome.

---

### 2. Home Tab

#### 2a. Idle State (no active workout)

Top section — **User Summary Card:**
- Display name + current rank title (e.g., "Pipsqueak")
- Current global level + XP bar showing progress to next level
- Small rank badge/icon

Middle section — **Quick Stats Strip (3 tiles):**
- Total workouts logged
- This week's volume (lbs)
- Current workout streak (days)

Lower section — **Recent Activity:**
- Last 3 workouts as compact cards (date, exercises hit, volume, XP earned)
- "View all" link → History tab

Bottom — **Primary CTA:**
- Large "Start Workout" button, full-width, prominent accent color

Secondary — **Log Data buttons (smaller row beneath):**
- "Log Weight" — opens a small modal to enter bodyweight
- "Add Photo" — opens device camera/photo picker

#### 2b. Active Workout State (workout in progress)

The home tab content is replaced by a live workout view when the workout bar is expanded (see Workout Bar below).

When the workout bar is collapsed, the home tab still shows the idle content but with a dimmed "workout in progress" banner at the top instead of the Start Workout button.

---

### 3. Workout Bar (Persistent, Active Workouts Only)

A strip that sits above the bottom tab bar whenever a workout is active. Always visible regardless of which tab you're on.

**Collapsed state (default):**
```
[ 💪 Workout in progress  |  0:42:15  |  3,240 lbs  ↑ expand ]
```
- Shows elapsed time (live, counting up)
- Shows total volume so far
- Tap anywhere to expand

**Expanded state (bottom sheet, slides up ~85% of screen height):**
This is the full workout logging UI. See Section 4.

---

### 4. Workout View (Expanded Bottom Sheet)

#### Header Bar (sticky at top of sheet)
- Elapsed time (live)
- Total volume so far
- "Finish Workout" button (top right) — triggers confirmation → workout summary

#### Rest Timer (inline, beneath header)
- **Optional and manual** — the timer is a utility the user chooses to use; it does not auto-start when a set is logged
- A "Start Rest" button appears beneath the header at all times during an active workout
- When running: shows countdown, a "Reset" button (restarts the timer from the configured duration), and a "Stop" button (dismisses it)
- Tap "+ 30s" to extend while running
- When timer hits zero: haptic pulse + subtle visual flash on the bar — no audio by default (gym environments make this unreliable)
- Rest duration is configurable in Profile settings with a global default of 90s

#### Exercise Accordion
The main body is an accordion. Each row is a category.

**Collapsed category row:**
```
[ 🦵 Legs  (2 exercises active)  ▶ ]
```
- Shows category name + icon
- Badge showing how many exercises in this category have been worked this session

**Expanded category (one open at a time — tapping another closes current):**
Inside the expanded category, exercises are listed as cards. Order: exercises already worked in this session appear first (sorted by most recently active), then remaining exercises alphabetically.

**Exercise card (not yet worked this session):**
```
Dumbbell Bench Press              Level 4  →
```
- Tap to expand into the set logging view

**Exercise card (worked this session — expanded inline, strength exercise):**
```
Dumbbell Bench Press              Level 4
─────────────────────────────────────────
  Set 1   25 lbs × 12   ✓   [edit] [delete]
  Set 2   25 lbs × 12   ✓   [edit] [delete]
  Set 3   25 lbs × 10   ✓   [edit] [delete]
─────────────────────────────────────────
  Weight [ 25  ] lbs    Reps [ 12 ]
  [ + Log Set ]
```

**Exercise card (worked this session — expanded inline, bodyweight exercise):**
```
Pull-Up                           Level 3
─────────────────────────────────────────
  Set 1   172 lbs × 8   ✓   [edit] [delete]
─────────────────────────────────────────
  Weight [ 172 ] lbs*   Reps [ 8  ]
  [ + Log Set ]
```
\* Weight pre-fills from the user's **7-day average bodyweight**. If no bodyweight data exists, the field is blank and the user must enter it manually. The field is always editable to support weighted pull-ups, dips, etc. (e.g., user adds a belt with extra weight).

**Exercise card (worked this session — expanded inline, cardio exercise):**
```
Treadmill Run                     —
─────────────────────────────────────────
  Set 1   1.5 mi · 18 min   ✓   [edit] [delete]
─────────────────────────────────────────
  Distance [ 1.5 ] mi    Duration [ 18 ] min
  [ + Log Set ]
```
- Cardio exercises swap the weight/reps fields for **Distance** (miles or km based on user preference) and **Duration** (minutes)
- Internally stored as `weight_lbs = distance` and `reps = duration_minutes` — the unit label is derived from the exercise's `equipment_type = 'cardio'` flag
- Cardio exercises have no level system (level column hidden)
- XP for cardio sets is calculated as `floor(distance * duration / 5)` — rewards effort without inflating XP relative to heavy lifting

**Common to all exercise cards:**
- Previous sets shown above the input row, each deletable/editable
- Input fields are numeric, large touch targets
- "Log Set" button is large, tappable with thumb
- Non-cardio weight field pre-fills from the last logged set for this exercise (or bodyweight average for bodyweight exercises)

#### Add Exercise
- At the bottom of the accordion, a "+ Add Exercise" button
- Opens a search/browse modal to find an exercise not yet in the current session

---

### 5. Exercises Tab

#### Exercise List View
- Segment control at top: All | Legs | Push | Pull | Core | Cardio | Misc
- Search bar (filters by name)
- Each exercise shown as a list row:
  ```
  Dumbbell Bench Press         Push  |  Level 4  →
  ```
- User-created exercises have a subtle "custom" tag
- FAB (floating action button): "+ New Exercise" → opens creation modal

#### Exercise Detail View (tap any exercise)
- Exercise name + category badge + equipment type
- **Strength exercises:**
  - **Current level card:** level number, current target (e.g., "3 × 12 @ 25 lbs"), progress toward next level (qualifying sets completed this target)
  - **Volume over time chart:** bar chart, x-axis = workout date, y-axis = total volume (lbs) for that exercise. Time range toggle: 1M / 3M / 6M / All
  - **Weight over time chart:** line chart showing max weight used per session
  - **Set history table:** paginated list of every logged set (date, weight, reps)
- **Cardio exercises:**
  - No level card
  - **Distance over time chart:** line chart of distance per session
  - **Duration over time chart:** line chart of duration per session
  - **Session history table:** date, distance, duration
- Edit button (top right): rename exercise, change category (user-created only)

---

### 6. History Tab

#### Workout List
- Chronological list, newest first
- Each card:
  ```
  Monday, March 9                    45 min
  Push + Pull                        +340 XP
  3 exercises · 9 sets · 12,400 lbs
  ```
- Tap → Workout Detail View

#### Workout Detail View
- Header: date, duration, XP earned, total volume
- Per-exercise breakdown:
  - Exercise name + level at time of workout
  - Each set: weight × reps
- Edit options:
  - Delete individual sets (swipe-to-delete on mobile)
  - Delete entire workout (with confirmation)
  - Edit set values (tap a set to modify weight/reps)
- Note field: editable free-text note for the session

---

### 7. Profile Tab

#### Top section — Rank Card
- Display name
- Rank title + rank icon/badge (large, prominent)
- Global level number
- XP bar: current XP / XP needed for next level
- Milestone label for next rank (e.g., "450 XP to reach Amateur")

#### Stats Section
- Total volume lifted (all time)
- Total sets logged
- Total workouts
- Longest streak / current streak

#### Bodyweight Section
- Latest logged weight + date
- Mini line chart (last 30 days)
- "Log Weight" shortcut button

#### Progress Photos Section
- Grid of thumbnails, newest first
- Tap to view full screen
- "Add Photo" button

#### Settings Section
- Weight unit toggle: lbs / kg
- Rest timer default duration
- Bodyweight reminder time (time picker, or disable)
- Progress photo reminder day (day picker, or disable)
- Sign out button

---

### 8. Workout Summary Screen (post-workout modal)

Shown full-screen after tapping "Finish Workout" and confirming.

```
  Workout Complete! 🎉

  Duration       Volume         XP Earned
  52 min         18,400 lbs     +482 XP

  ─── Exercises ────────────────────
  Dumbbell Bench Press   3 sets   2,700 lbs
  Lat Pulldown           3 sets   3,600 lbs
  Bicep Curl             3 sets   1,080 lbs
  ──────────────────────────────────

  [level up celebration if applicable]

  [ Done ]
```

If any exercise leveled up during the workout, it's called out here with a small celebration animation (e.g., a badge or burst). If the user's global level increased, a larger full-screen moment plays before this summary.

---

### 9. Level-Up Celebration

Two tiers:

**Exercise level-up (inline):** A brief animated badge/burst on the exercise card in the workout view, immediately after logging the qualifying set. A small toast: "Dumbbell Bench Press → Level 5!". Non-blocking.

**Global level-up (full screen):** A full-screen overlay that slides in. Shows new rank title, level number, and a brief animation. Requires a tap to dismiss. Shown after the workout finishes (not mid-workout to avoid interruption).

---

## Technical Implementation Details

### Dependencies to Add

```
# Core routing
react-router-dom

# Supabase client
@supabase/supabase-js

# Styling
tailwindcss
@tailwindcss/vite

# Animations
framer-motion           # level-up celebrations, sheet animations, accordion

# Charts
recharts                # volume/weight over time

# Date handling
date-fns                # formatting, week/streak calculations
```

shadcn/ui components needed: `Sheet`, `Accordion`, `Dialog`, `Toast`/`Sonner`, `Button`, `Input`, `Badge`, `Progress`, `Tabs`, `Avatar`

### File / Folder Structure

```
src/
  components/
    ui/               # shadcn auto-generated components
    layout/
      BottomNav.tsx
      WorkoutBar.tsx
    workout/
      WorkoutSheet.tsx
      ExerciseAccordion.tsx
      SetRow.tsx
      RestTimer.tsx
    exercises/
      ExerciseList.tsx
      ExerciseDetail.tsx
    home/
      UserSummaryCard.tsx
      QuickStats.tsx
      RecentActivity.tsx
    history/
      WorkoutCard.tsx
      WorkoutDetail.tsx
    profile/
      RankCard.tsx
      BodyweightSection.tsx
      ProgressPhotos.tsx
    shared/
      XPBar.tsx
      LevelBadge.tsx
      LevelUpOverlay.tsx
      WorkoutSummaryModal.tsx
  pages/
    HomePage.tsx
    ExercisesPage.tsx
    HistoryPage.tsx
    ProfilePage.tsx
    AuthPage.tsx
  hooks/
    useActiveWorkout.ts     # global workout session state
    useProfile.ts
    useExercises.ts
    useWorkouts.ts
  lib/
    supabase.ts             # supabase client init
    xp.ts                   # XP formula, level thresholds, rank table
    levelUp.ts              # exercise level-up check logic
    units.ts                # lbs ↔ kg conversion
  context/
    WorkoutContext.tsx       # active workout state, shared across all tabs
  types/
    index.ts                 # TypeScript types mirroring DB schema
```

### State Management

No external state library needed. The app has one piece of truly global state: the **active workout**. Everything else is server state fetched via Supabase.

- `WorkoutContext` — holds the current workout ID, live sets, elapsed time, and rest timer state. Persists in `localStorage` so a page refresh doesn't kill an in-progress workout.
- All other data fetched with custom hooks wrapping Supabase queries.
- Consider `@tanstack/react-query` (TanStack Query) if data fetching/caching complexity grows, but start without it.

### Routing (React Router v6)

```
/                    → HomePage
/exercises           → ExercisesPage
/exercises/:id       → ExerciseDetail
/history             → HistoryPage
/history/:id         → WorkoutDetail
/profile             → ProfilePage
/auth                → AuthPage
```

The bottom tab bar links to the first four routes. The workout sheet is not a route — it's a context-driven overlay rendered at the app root level.

### Rest Timer Implementation

- State lives in `WorkoutContext` alongside the active workout
- Fields: `restTimerActive: boolean`, `restTimerSeconds: number`, `restTimerDuration: number`
- A single `useEffect` interval ticks it down while active; does nothing until the user manually starts it
- The user starts it by tapping "Start Rest" in the workout sheet header area
- "Reset" restarts from `restTimerDuration`; "Stop" sets `restTimerActive = false` and resets to full duration
- When timer hits zero: `navigator.vibrate()` for haptic feedback + brief visual flash on the collapsed workout bar — no audio
- `restTimerDuration` is read from profile settings (default 90s) and can be changed per session via a small stepper in the UI

### Gamification Constants (`src/lib/xp.ts`)

```ts
// XP per set
export const calcSetXP = (weightLbs: number, reps: number) =>
  Math.floor((weightLbs * reps) / 10);

// Global level thresholds (cumulative XP required)
export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, // 1-10
  // ... continues
];

// Rank titles mapped to level
export const RANKS: { minLevel: number; title: string }[] = [
  { minLevel: 1,   title: 'Pipsqueak' },
  { minLevel: 5,   title: 'Rookie' },
  { minLevel: 10,  title: 'Amateur' },
  { minLevel: 20,  title: 'Contender' },
  { minLevel: 35,  title: 'Lifter' },
  { minLevel: 50,  title: 'Iron' },
  { minLevel: 65,  title: 'Beast' },
  { minLevel: 80,  title: 'Apex' },
  { minLevel: 100, title: 'Silverback' },
];
```

---

## Resolved Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | CSS / component framework | Tailwind CSS + shadcn/ui |
| 2 | Color theme | Midnight + Amber (`#0F0F14` bg, `#F59E0B` accent) |
| 3 | Rest timer trigger | Manual — user taps "Start Rest". Timer has Reset and Stop buttons. No auto-start. |
| 4 | Cardio logging format | Distance + Duration fields (stored as `weight_lbs` = distance, `reps` = duration in minutes internally) |
| 5 | Bodyweight exercise default | Pre-fill weight from 7-day average bodyweight. If no data, field is blank. Always editable. |
