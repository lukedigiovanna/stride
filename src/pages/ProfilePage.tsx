import { useEffect, useState } from 'react';
import { startOfDay, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import RankCard from '@/components/profile/RankCard';
import BodyweightSection from '@/components/profile/BodyweightSection';
import ProgressPhotos from '@/components/profile/ProgressPhotos';
import {
  requestNotificationPermission,
  scheduleBodyweightReminder,
  cancelBodyweightReminder,
  scheduleProgressPhotoReminder,
  cancelProgressPhotoReminder,
  notificationsSupported,
} from '@/lib/notifications';
import type { DayOfWeek, Workout, WeightUnit } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const BREAK_DAYS = 7;

/**
 * Best streak = longest period (in days) without a 7+ day break, across all time.
 * For the currently-active period, counts through today.
 */
function computeBestStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;

  const days = [...new Set(
    workouts.map((w) => startOfDay(parseISO(w.started_at)).getTime()),
  )].sort((a, b) => a - b);

  const today = startOfDay(new Date()).getTime();

  let best = 0;
  let segmentStart = days[0];

  for (let i = 1; i < days.length; i++) {
    if ((days[i] - days[i - 1]) / MS_PER_DAY >= BREAK_DAYS) {
      best = Math.max(best, Math.round((days[i - 1] - segmentStart) / MS_PER_DAY) + 1);
      segmentStart = days[i];
    }
  }

  // Last / current segment: extend through today if not yet broken
  const lastDay = days[days.length - 1];
  const segmentEnd = (today - lastDay) / MS_PER_DAY < BREAK_DAYS ? today : lastDay;
  best = Math.max(best, Math.round((segmentEnd - segmentStart) / MS_PER_DAY) + 1);

  return best;
}

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'sunday',    label: 'Sunday'    },
  { value: 'monday',    label: 'Monday'    },
  { value: 'tuesday',   label: 'Tuesday'   },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday',  label: 'Thursday'  },
  { value: 'friday',    label: 'Friday'    },
  { value: 'saturday',  label: 'Saturday'  },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="flex items-center px-4 h-9 border-t border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ─── Settings row ─────────────────────────────────────────────────────────────

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

// ─── Lifetime stats tile ──────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuth();

  // Lifetime stats state
  const [totalWorkouts, setTotalWorkouts] = useState<number | null>(null);
  const [totalSets, setTotalSets] = useState<number | null>(null);
  const [totalVolumeLbs, setTotalVolumeLbs] = useState<number | null>(null);
  const [bestStreak, setBestStreak] = useState<number | null>(null);

  // Settings local state (mirrors profile)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile?.weight_unit ?? 'lbs');
  const [reminderTime, setReminderTime] = useState(profile?.bodyweight_reminder_time?.slice(0, 5) ?? '');
  const [photoDay, setPhotoDay] = useState<DayOfWeek | ''>(profile?.progress_photo_reminder_day ?? '');

  // Sync when profile loads
  useEffect(() => {
    if (!profile) return;
    const t = setTimeout(() => {
      setWeightUnit(profile.weight_unit);
      setReminderTime(profile.bodyweight_reminder_time?.slice(0, 5) ?? '');
      setPhotoDay(profile.progress_photo_reminder_day ?? '');
    }, 0);
    return () => clearTimeout(t);
  }, [profile]);

  // Load lifetime stats
  useEffect(() => {
    if (!user) return;

    async function load() {
      // 1. Total completed workouts (count + all started_at for streak)
      const { data: workoutRows, count } = await supabase
        .from('workouts')
        .select('id, started_at', { count: 'exact' })
        .eq('user_id', user!.id)
        .not('ended_at', 'is', null);

      setTotalWorkouts(count ?? 0);
      setBestStreak(computeBestStreak((workoutRows ?? []) as Workout[]));

      if (!workoutRows || workoutRows.length === 0) {
        setTotalSets(0);
        setTotalVolumeLbs(0);
        return;
      }

      // 2. All sets for volume + count
      const workoutIds = (workoutRows as { id: string }[]).map((w) => w.id);
      const { data: setRows } = await supabase
        .from('sets')
        .select('weight_lbs, reps, exercise_id')
        .in('workout_id', workoutIds);

      const sets = (setRows ?? []) as { weight_lbs: number; reps: number; exercise_id: string }[];
      setTotalSets(sets.length);

      // 3. Exercise categories to exclude cardio from volume
      const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
      const { data: exRows } = await supabase
        .from('exercises')
        .select('id, category')
        .in('id', exerciseIds);

      const cardioIds = new Set(
        (exRows ?? [])
          .filter((e: { category: string }) => e.category === 'cardio')
          .map((e: { id: string }) => e.id),
      );

      const vol = sets.reduce(
        (sum, s) => (cardioIds.has(s.exercise_id) ? sum : sum + s.weight_lbs * s.reps),
        0,
      );
      setTotalVolumeLbs(vol);
    }

    load();
  }, [user]);

  async function saveProfileField(field: Partial<typeof profile>) {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(field).eq('id', user.id);
    if (!error) updateProfile(field as Partial<NonNullable<typeof profile>>);
  }

  async function handleWeightUnitChange(unit: WeightUnit) {
    setWeightUnit(unit);
    await saveProfileField({ weight_unit: unit });
  }

  async function handleReminderTimeChange(val: string) {
    setReminderTime(val);
    await saveProfileField({ bodyweight_reminder_time: val ? `${val}:00` : null });
    if (val && notificationsSupported()) {
      const granted = await requestNotificationPermission();
      if (granted) scheduleBodyweightReminder(val);
    } else if (!val) {
      cancelBodyweightReminder();
    }
  }

  async function handlePhotoDayChange(val: string) {
    const day = val === '' ? null : (val as DayOfWeek);
    setPhotoDay(day ?? '');
    await saveProfileField({ progress_photo_reminder_day: day });
    if (day && notificationsSupported()) {
      const granted = await requestNotificationPermission();
      if (granted) scheduleProgressPhotoReminder(day);
    } else if (!day) {
      cancelProgressPhotoReminder();
    }
  }

  function fmtVol(lbs: number) {
    if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M lbs`;
    if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
    return `${Math.round(lbs)} lbs`;
  }

  if (!profile) return null;

  const selectClass =
    'bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 py-1 text-sm text-foreground focus:outline-none focus:border-foreground transition-colors';

  return (
    <div className="flex flex-col overflow-y-auto h-full pb-6">
      {/* Page title */}
      <div className="px-4 pt-5 pb-4 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-foreground">Profile</h1>
      </div>

      <div className="pt-5 pb-6">
        {/* Rank card */}
        <RankCard profile={profile} />

        {/* Lifetime stats */}
        <Section title="Lifetime Stats">
          <div>
            <StatRow label="Workouts" value={totalWorkouts !== null ? String(totalWorkouts) : '—'} />
            <StatRow label="Total Sets" value={totalSets !== null ? String(totalSets) : '—'} />
            <StatRow label="Volume" value={totalVolumeLbs !== null ? fmtVol(totalVolumeLbs) : '—'} />
            <StatRow label="Best Streak" value={bestStreak !== null ? String(bestStreak) : '—'} />
          </div>
        </Section>

        {/* Bodyweight */}
        <Section title="Bodyweight">
          <BodyweightSection unit={profile.weight_unit} />
        </Section>

        {/* Progress photos */}
        <Section title="Progress Photos">
          <ProgressPhotos />
        </Section>

        {/* Settings */}
        <Section title="Settings">
          <div>
            {/* Weight unit */}
            <SettingRow label="Weight unit">
              <div className="flex rounded-sm border border-border overflow-hidden text-xs font-bold">
                {(['lbs', 'kg'] as WeightUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => handleWeightUnitChange(u)}
                    className={`px-3 py-1.5 transition-colors ${
                      weightUnit === u
                        ? 'bg-foreground text-background'
                        : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </SettingRow>

            {/* Bodyweight reminder */}
            <SettingRow label="Bodyweight reminder">
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => handleReminderTimeChange(e.target.value)}
                className={selectClass}
              />
            </SettingRow>

            {/* Progress photo reminder */}
            <SettingRow label="Photo reminder day">
              <select
                value={photoDay}
                onChange={(e) => handlePhotoDayChange(e.target.value)}
                className={selectClass}
              >
                <option value="">Off</option>
                {DAY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </SettingRow>
          </div>
        </Section>

        {/* Sign out */}
        <div className="px-4 mt-6">
          <button
            onClick={signOut}
            className="w-full rounded-sm border border-destructive/40 py-3 text-sm font-bold text-destructive active:bg-destructive/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
