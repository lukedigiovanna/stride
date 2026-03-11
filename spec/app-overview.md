# Stride — App Overview

## What Is Stride?

Stride is a gamified weightlifting logger PWA (Progressive Web App). It replaces the fragmented, manual approach of tracking lifts in notes apps with a clean, purpose-built experience that lives anywhere the user signs in. Stride turns the slow, unglamorous grind of getting stronger into something that feels like leveling up a character — because it is.

---

## Core Problems Being Solved

1. **Fragmented tracking** — Lifts, bodyweight, and progress photos scattered across multiple notes.
2. **No insight** — Raw notes give no trend analysis, no volume tracking, no sense of progress over time.
3. **No accountability** — Nothing prompts the user to log consistently or celebrate milestones.
4. **No structure** — It's hard to know what to do next or whether progress is actually happening.

---

## Who Uses It?

Stride is designed for individual users who lift recreationally and want a personal training log with smart features. While the product is initially built for a single user, the architecture supports multiple independent accounts so the app can grow or be shared.

---

## Core Concepts

### Exercises
An exercise is a named movement (e.g., "Dumbbell Bench Press", "Squat", "Lat Pulldown"). Each exercise belongs to one of six categories:

- **Legs** — squats, lunges, leg press, hamstring curls, etc.
- **Push** — chest press, shoulder press, tricep work, etc.
- **Pull** — rows, pull-ups, lat pulldowns, bicep curls, etc.
- **Core** — planks, crunches, ab rollouts, etc.
- **Cardio** — running, cycling, rowing, jump rope, etc.
- **Miscellaneous** — anything that doesn't fit cleanly elsewhere.

Users can create new exercises at any time and assign them to a category.

### Sets & Logging
Each time a user performs a set, they log:
- Exercise name
- Weight used (lbs or kg, user preference)
- Reps performed
- Timestamp (recorded automatically)

Multiple sets for the same exercise in a single session form a **workout entry** for that exercise on that day.

### Workouts
A workout is a time-bounded session. It groups all sets logged within a contiguous period of activity. At the end of a session, the user can view a **workout summary** showing all exercises, sets, total volume, duration, and XP earned.

### Exercise Levels (Progression System)
Every exercise has a **level** that reflects the user's current strength benchmark for that movement. Levels are tied to specific weight/rep targets:

- Each level defines a target: e.g., "3 sets of 12 reps at 10 lbs"
- When the user successfully hits that target in a session, they advance to the next level
- Level thresholds are pre-defined per exercise based on standard dumbbell/barbell increments (e.g., every 5 lbs for dumbbells)
- Leveling up triggers a visible celebration moment in the app

This makes progression feel concrete and rewarding — the user always knows exactly what they're working toward.

### User Level & XP
Beyond individual exercise levels, the user has a **global level** representing their overall lifting experience.

- Every set logged earns XP based on **volume** (weight × reps)
- XP accumulates across all exercises and workouts
- The user's global level unlocks a **rank title** (e.g., "Pipsqueak" at Level 1, escalating through fun milestones up to something like "Silverback" or "Iron Giant" at the highest levels)
- The rank system is meant to be lighthearted and motivating

### Bodyweight Tracking
The user can log their bodyweight at any time. The app tracks this over time and visualizes trends. The user can optionally set a daily logging goal and receive a reminder if they haven't logged by a set time (e.g., 10 PM).

### Progress Photos
The user can upload progress photos tagged with a date. The app can prompt the user to take a progress photo on a recurring schedule (e.g., every Sunday). Photos are stored privately per-user.

---

## Key Features

### Lift Logging
- Fast, minimal interface to log sets during a workout
- Easy navigation between exercise categories
- Supports multiple exercises per session
- Auto-timestamps every set

### Exercise Management
- Browse exercises filtered by category (Legs, Push, Pull, Core, Cardio, Misc)
- Create custom exercises with a name and category
- View per-exercise history: all past sets, weight used, dates

### Progression & Gamification
- Per-exercise level system with defined weight/rep milestones
- Global user XP and level, earned by logging volume
- Rank titles that escalate with level (lighthearted and fun)
- Celebration moments when leveling up an exercise or the global level

### Data & Insights
- **Weight over time** — chart of bodyweight logged across dates
- **Volume over time** — total volume (weight × reps) per workout session, per exercise, or across all lifts
- **Workout summaries** — review any past session with full set-by-set breakdown, duration, and XP earned
- **Exercise history** — see every logged set for a given exercise across time

### Notifications & Reminders (where supported)
- Daily bodyweight reminder if not yet logged by a user-defined time
- Weekly progress photo prompt (e.g., every Sunday)
- Workout streaks or milestones (stretch goal)

> **Note on iOS PWA notifications:** As of 2023, iOS 16.4+ supports Web Push Notifications for PWAs added to the home screen. This means push notifications are possible on iOS, with the caveat that the user must have the app installed to their home screen. The app should gracefully degrade if notifications are not supported.

### Authentication & Sync
- Users sign in with an account (email/password or OAuth)
- All data is stored in the cloud (Supabase) and synced across devices
- Works offline with local caching; syncs when connectivity is restored (stretch goal)

---

## Design Principles

1. **Speed first** — Logging a set mid-workout must be fast. The user should be able to open the app, find their exercise, and log a set in under 10 seconds.
2. **Clean and minimal** — No clutter. Each screen has one clear purpose.
3. **Rewarding** — Every interaction should subtly reinforce progress. Numbers go up. Levels rise. The user feels like they're building something.
4. **Mobile-first** — The app is used primarily in a gym, on a phone. Desktop is a nice-to-have for reviewing data.

---

## Out of Scope (for Now)

- Social features (sharing, leaderboards, following others)
- AI-generated workout plans
- Integration with wearables or external fitness APIs
- Video demonstrations of exercises
- Paid tiers or subscriptions

---

## Summary of Core User Flows

| Flow | Description |
|---|---|
| Log a workout | Open app → pick category → pick exercise → log sets → end session → view summary |
| Review progress | Open exercise → view history and level → see chart of weight/volume over time |
| Create exercise | Tap "New Exercise" → enter name → select category → save |
| Log bodyweight | Tap bodyweight widget → enter value → save |
| Upload progress photo | Navigate to progress photos → upload photo (or tap from reminder notification) |
| View stats | Open dashboard → view XP, global level, rank, recent volume charts |
| Level up exercise | Hit target sets/reps/weight → app celebrates → exercise advances to next level |
