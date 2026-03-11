import type { DayOfWeek } from '@/types';

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Lazily requests notification permission.
 * Returns true if granted, false otherwise.
 * Call only when the user explicitly enables a reminder — never on first load.
 *
 * Note: on iOS, notifications require the PWA to be added to the Home Screen
 * (iOS 16.4+). Without Home Screen install, this will return false.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const notificationsSupported = (): boolean =>
  'Notification' in window && 'serviceWorker' in navigator;

// ─── Show ─────────────────────────────────────────────────────────────────────

/**
 * Fires a notification via the service worker (works even when the app is
 * backgrounded on supported platforms). Falls back to the Notification
 * constructor when no SW is available.
 */
async function showNotification(title: string, body: string): Promise<void> {
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
    });
  } catch {
    // SW not available — use Notification constructor (requires app to be open)
    new Notification(title, {
      body,
      icon: '/web-app-manifest-192x192.png',
    });
  }
}

// ─── Bodyweight reminder ──────────────────────────────────────────────────────

let bodyweightTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedules a daily notification at the given time (HH:MM).
 * Replaces any existing bodyweight reminder timer.
 */
export const scheduleBodyweightReminder = (timeString: string): void => {
  if (bodyweightTimer) { clearTimeout(bodyweightTimer); bodyweightTimer = null; }

  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return;

  function scheduleNext() {
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const delay = target.getTime() - now.getTime();
    bodyweightTimer = setTimeout(async () => {
      await showNotification(
        'Log your bodyweight',
        "Tap to open Stride and record today's weight.",
      );
      scheduleNext(); // reschedule for tomorrow
    }, delay);
  }

  scheduleNext();
};

export const cancelBodyweightReminder = (): void => {
  if (bodyweightTimer) { clearTimeout(bodyweightTimer); bodyweightTimer = null; }
};

// ─── Progress photo reminder ──────────────────────────────────────────────────

let photoTimer: ReturnType<typeof setTimeout> | null = null;

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Schedules a weekly notification on the given day of the week (at 9 AM).
 * Replaces any existing progress photo reminder timer.
 */
export const scheduleProgressPhotoReminder = (day: DayOfWeek): void => {
  if (photoTimer) { clearTimeout(photoTimer); photoTimer = null; }

  const targetDayIndex = DAY_INDEX[day];

  function scheduleNext() {
    const now = new Date();
    const daysUntil = ((targetDayIndex - now.getDay() + 7) % 7) || 7;
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntil);
    target.setHours(9, 0, 0, 0);

    const delay = target.getTime() - now.getTime();
    photoTimer = setTimeout(async () => {
      await showNotification(
        'Progress photo day',
        'Time to take your weekly progress photo in Stride!',
      );
      scheduleNext();
    }, delay);
  }

  scheduleNext();
};

export const cancelProgressPhotoReminder = (): void => {
  if (photoTimer) { clearTimeout(photoTimer); photoTimer = null; }
};

// ─── Bootstrap on app load ────────────────────────────────────────────────────

/**
 * Called once on app start. If the user has reminders configured and has
 * granted permission, schedule them for this session.
 */
export const bootstrapReminders = (
  bodyweightReminderTime: string | null,
  progressPhotoDay: DayOfWeek | null,
): void => {
  if (Notification.permission !== 'granted') return;
  if (bodyweightReminderTime) scheduleBodyweightReminder(bodyweightReminderTime.slice(0, 5));
  if (progressPhotoDay) scheduleProgressPhotoReminder(progressPhotoDay);
};
