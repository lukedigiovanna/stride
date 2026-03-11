# Stride — Supabase Setup Guide

This guide walks through creating the Supabase project and running all SQL needed to get the database fully configured. Everything here matches the schema defined in `database-schema.md`.

---

## 1. Create the Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Set:
   - **Name:** `stride`
   - **Database password:** generate a strong one and save it somewhere safe
   - **Region:** pick the one closest to you
4. Click **Create new project** and wait ~2 minutes for provisioning.

---

## 2. Install the Supabase CLI (optional but recommended)

The CLI lets you manage migrations as version-controlled SQL files. If you'd rather just paste SQL into the dashboard, skip to step 3.

```bash
brew install supabase/tap/supabase
```

Link your project (run from the repo root):

```bash
supabase login
supabase init          # creates supabase/ folder in project root
supabase link          # prompts you to pick your project
```

From this point, create each migration as a file in `supabase/migrations/` and run:

```bash
supabase db push
```

Or paste the SQL blocks below directly into the **SQL Editor** in the Supabase dashboard (Database → SQL Editor → New query).

---

## 3. Run the Migrations

Run each block in order. They are safe to run together as a single script if you prefer.

---

### Migration 001 — Enable UUID extension

```sql
create extension if not exists "pgcrypto";
```

---

### Migration 002 — Create `profiles` table + auto-create trigger

```sql
create table public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  display_name                text,
  weight_unit                 text not null default 'lbs' check (weight_unit in ('lbs', 'kg')),
  total_xp                    integer not null default 0,
  bodyweight_reminder_time    time,
  progress_photo_reminder_day text check (
    progress_photo_reminder_day in (
      'sunday','monday','tuesday','wednesday','thursday','friday','saturday'
    )
  ),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Automatically create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
```

---

### Migration 003 — Create `exercises` table

```sql
create table public.exercises (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete cascade,
  name                 text not null,
  category             text not null check (category in ('legs','push','pull','core','cardio','misc')),
  equipment_type       text not null default 'other' check (
    equipment_type in ('dumbbell','barbell','cable','bodyweight','machine','other')
  ),
  level_increment_lbs  numeric,
  created_at           timestamptz not null default now()
);

create index exercises_user_id_idx on public.exercises (user_id);
create index exercises_category_idx on public.exercises (category);
```

---

### Migration 004 — Create `user_exercise_progress` table

```sql
create table public.user_exercise_progress (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  exercise_id             uuid not null references public.exercises(id) on delete cascade,
  current_level           integer not null default 1,
  level_target_weight_lbs numeric,
  level_target_reps       integer not null default 12,
  level_target_sets       integer not null default 3,
  updated_at              timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create trigger user_exercise_progress_updated_at
  before update on public.user_exercise_progress
  for each row execute procedure public.set_updated_at();
```

---

### Migration 005 — Create `workouts` table

```sql
create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text,
  xp_earned   integer not null default 0,
  created_at  timestamptz not null default now()
);

create index workouts_user_id_started_at_idx on public.workouts (user_id, started_at desc);
```

---

### Migration 006 — Create `sets` table

```sql
create table public.sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number  integer not null,
  weight_lbs  numeric not null,
  reps        integer not null,
  logged_at   timestamptz not null default now(),
  notes       text
);

create index sets_user_exercise_time_idx on public.sets (user_id, exercise_id, logged_at desc);
create index sets_user_workout_idx       on public.sets (user_id, workout_id);
create index sets_user_time_idx          on public.sets (user_id, logged_at desc);
```

---

### Migration 007 — Create `bodyweight_logs` table

```sql
create table public.bodyweight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  weight_lbs numeric not null,
  logged_at  timestamptz not null default now(),
  notes      text
);

create index bodyweight_logs_user_time_idx on public.bodyweight_logs (user_id, logged_at desc);
```

---

### Migration 008 — Create `progress_photos` table

```sql
create table public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  taken_on     date not null,
  notes        text,
  uploaded_at  timestamptz not null default now()
);

create index progress_photos_user_date_idx on public.progress_photos (user_id, taken_on desc);
```

---

## 4. Enable Row Level Security

Run this to lock down every table. After this, no data is readable or writable without an explicit policy.

```sql
alter table public.profiles              enable row level security;
alter table public.exercises             enable row level security;
alter table public.user_exercise_progress enable row level security;
alter table public.workouts              enable row level security;
alter table public.sets                  enable row level security;
alter table public.bodyweight_logs       enable row level security;
alter table public.progress_photos       enable row level security;
```

---

## 5. Create RLS Policies

### `profiles`

```sql
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
```

### `exercises`

```sql
-- Read: own exercises OR global exercises (user_id is null)
create policy "Users can read own and global exercises"
  on public.exercises for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users can insert own exercises"
  on public.exercises for insert
  with check (auth.uid() = user_id);

create policy "Users can update own exercises"
  on public.exercises for update
  using (auth.uid() = user_id);

create policy "Users can delete own exercises"
  on public.exercises for delete
  using (auth.uid() = user_id);
```

### `user_exercise_progress`

```sql
create policy "Users can read own exercise progress"
  on public.user_exercise_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own exercise progress"
  on public.user_exercise_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own exercise progress"
  on public.user_exercise_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete own exercise progress"
  on public.user_exercise_progress for delete
  using (auth.uid() = user_id);
```

### `workouts`

```sql
create policy "Users can read own workouts"
  on public.workouts for select
  using (auth.uid() = user_id);

create policy "Users can insert own workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workouts"
  on public.workouts for update
  using (auth.uid() = user_id);

create policy "Users can delete own workouts"
  on public.workouts for delete
  using (auth.uid() = user_id);
```

### `sets`

```sql
create policy "Users can read own sets"
  on public.sets for select
  using (auth.uid() = user_id);

create policy "Users can insert own sets"
  on public.sets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sets"
  on public.sets for update
  using (auth.uid() = user_id);

create policy "Users can delete own sets"
  on public.sets for delete
  using (auth.uid() = user_id);
```

### `bodyweight_logs`

```sql
create policy "Users can read own bodyweight logs"
  on public.bodyweight_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own bodyweight logs"
  on public.bodyweight_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bodyweight logs"
  on public.bodyweight_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own bodyweight logs"
  on public.bodyweight_logs for delete
  using (auth.uid() = user_id);
```

### `progress_photos`

```sql
create policy "Users can read own progress photos"
  on public.progress_photos for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress photos"
  on public.progress_photos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress photos"
  on public.progress_photos for update
  using (auth.uid() = user_id);

create policy "Users can delete own progress photos"
  on public.progress_photos for delete
  using (auth.uid() = user_id);
```

---

## 6. Seed Default Exercises

These are the global exercises available to all users (`user_id = null`).

```sql
insert into public.exercises (user_id, name, category, equipment_type, level_increment_lbs) values
  -- Legs
  (null, 'Barbell Squat',          'legs', 'barbell',    10),
  (null, 'Dumbbell Lunge',         'legs', 'dumbbell',    5),
  (null, 'Leg Press',              'legs', 'machine',    20),
  (null, 'Romanian Deadlift',      'legs', 'barbell',    10),
  (null, 'Leg Curl',               'legs', 'machine',    10),
  (null, 'Leg Extension',          'legs', 'machine',    10),
  (null, 'Calf Raise',             'legs', 'machine',    10),
  (null, 'Goblet Squat',           'legs', 'dumbbell',    5),
  -- Push
  (null, 'Barbell Bench Press',    'push', 'barbell',    10),
  (null, 'Dumbbell Bench Press',   'push', 'dumbbell',    5),
  (null, 'Incline Dumbbell Press', 'push', 'dumbbell',    5),
  (null, 'Overhead Press',         'push', 'barbell',    10),
  (null, 'Dumbbell Shoulder Press','push', 'dumbbell',    5),
  (null, 'Lateral Raise',          'push', 'dumbbell',  2.5),
  (null, 'Tricep Pushdown',        'push', 'cable',       5),
  (null, 'Skull Crusher',          'push', 'barbell',     5),
  (null, 'Push-Up',                'push', 'bodyweight', null),
  (null, 'Dips',                   'push', 'bodyweight', null),
  -- Pull
  (null, 'Pull-Up',                'pull', 'bodyweight', null),
  (null, 'Lat Pulldown',           'pull', 'cable',       5),
  (null, 'Seated Cable Row',       'pull', 'cable',       5),
  (null, 'Barbell Row',            'pull', 'barbell',    10),
  (null, 'Dumbbell Row',           'pull', 'dumbbell',    5),
  (null, 'Face Pull',              'pull', 'cable',       5),
  (null, 'Barbell Deadlift',       'pull', 'barbell',    10),
  (null, 'Bicep Curl',             'pull', 'dumbbell',  2.5),
  (null, 'Hammer Curl',            'pull', 'dumbbell',  2.5),
  -- Core
  (null, 'Plank',                  'core', 'bodyweight', null),
  (null, 'Crunch',                 'core', 'bodyweight', null),
  (null, 'Hanging Leg Raise',      'core', 'bodyweight', null),
  (null, 'Cable Crunch',           'core', 'cable',       5),
  (null, 'Ab Rollout',             'core', 'other',      null),
  (null, 'Russian Twist',          'core', 'other',      null),
  -- Cardio
  (null, 'Treadmill Run',          'cardio', 'machine',  null),
  (null, 'Stationary Bike',        'cardio', 'machine',  null),
  (null, 'Rowing Machine',         'cardio', 'machine',  null),
  (null, 'Jump Rope',              'cardio', 'other',    null),
  (null, 'Stair Climber',          'cardio', 'machine',  null),
  -- Misc
  (null, 'Farmer Carry',           'misc', 'dumbbell',    5),
  (null, 'Battle Ropes',           'misc', 'other',      null),
  (null, 'Box Jump',               'misc', 'other',      null),
  (null, 'Sled Push',              'misc', 'other',      null);
```

---

## 7. Set Up Supabase Storage

1. In the Supabase dashboard, go to **Storage**.
2. Click **New bucket**.
3. Set:
   - **Name:** `progress-photos`
   - **Public bucket:** OFF (keep it private)
4. Click **Create bucket**.

Then add storage policies so users can only access their own folder. Go to **Storage → Policies** and add these for the `progress-photos` bucket:

```sql
-- Allow users to upload to their own folder
create policy "Users can upload own progress photos"
  on storage.objects for insert
  with check (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to read their own photos
create policy "Users can read own progress photos"
  on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own photos
create policy "Users can delete own progress photos"
  on storage.objects for delete
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 8. Get Your Project Credentials

In the Supabase dashboard go to **Project Settings → API**. You'll need:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (e.g., `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | `anon` / `public` key |

Create a `.env.local` file in the project root:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

The anon key is safe to include in the client bundle — it only grants access according to your RLS policies. Never put the `service_role` key in the frontend.

---

## 9. Verify Everything

After running all the SQL, confirm in the Supabase dashboard:

- **Table Editor** shows all 7 tables: `profiles`, `exercises`, `user_exercise_progress`, `workouts`, `sets`, `bodyweight_logs`, `progress_photos`
- **Authentication → Policies** shows policies on every table (the shield icon should be green, not grey)
- **Storage** shows the `progress-photos` bucket with its 3 policies
- **Table Editor → exercises** shows the seeded default exercises

You can do a quick smoke test by creating a user via **Authentication → Users → Invite user**, then checking that a `profiles` row was auto-created for them.

---

## Checklist

- [ ] Supabase project created
- [ ] Migration 001 — UUID extension
- [ ] Migration 002 — `profiles` table + trigger
- [ ] Migration 003 — `exercises` table
- [ ] Migration 004 — `user_exercise_progress` table
- [ ] Migration 005 — `workouts` table
- [ ] Migration 006 — `sets` table
- [ ] Migration 007 — `bodyweight_logs` table
- [ ] Migration 008 — `progress_photos` table
- [ ] RLS enabled on all tables
- [ ] RLS policies created for all tables
- [ ] Default exercises seeded
- [ ] `progress-photos` storage bucket created (private)
- [ ] Storage policies applied
- [ ] `.env.local` created with project URL and anon key
