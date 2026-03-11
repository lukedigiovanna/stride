import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useWorkout } from '@/context/WorkoutContext';
import { useAuth } from '@/context/AuthContext';
import { bootstrapReminders } from '@/lib/notifications';
import BottomNav from './BottomNav';
import WorkoutBar from './WorkoutBar';

/** Height of the fixed bottom nav bar in px (matches h-16 = 4rem = 64px). */
const NAV_HEIGHT_PX = 64;
/** Height of the workout bar in px (matches WorkoutBar's inline height). */
const WORKOUT_BAR_HEIGHT_PX = 52;

/**
 * Root layout for all authenticated pages.
 *
 * Renders as a React Router layout route (<Outlet /> for page content)
 * with the fixed BottomNav and conditional WorkoutBar layered below.
 *
 * Bottom padding on the scrollable content area is computed dynamically
 * so page content is never obscured by the fixed chrome.
 */
export default function AppLayout() {
  const { isWorkoutActive } = useWorkout();
  const { profile } = useAuth();

  // Bootstrap notification reminders once profile is loaded
  useEffect(() => {
    if (!profile) return;
    bootstrapReminders(
      profile.bodyweight_reminder_time ?? null,
      profile.progress_photo_reminder_day ?? null,
    );
  }, [profile]); // run once per user session

  const bottomPadding = isWorkoutActive
    ? NAV_HEIGHT_PX + WORKOUT_BAR_HEIGHT_PX
    : NAV_HEIGHT_PX;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Scrollable page content */}
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: `calc(${bottomPadding}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <Outlet />
      </main>

      {/* Workout bar — only visible when a session is active */}
      <WorkoutBar />

      {/* Bottom tab navigation */}
      <BottomNav />
    </div>
  );
}
