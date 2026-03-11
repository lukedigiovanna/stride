import { useState } from 'react';
import { Scale } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWorkout } from '@/context/WorkoutContext';
import { Button } from '@/components/ui/button';
import UserSummaryCard from '@/components/home/UserSummaryCard';
import QuickStats from '@/components/home/QuickStats';
import RecentActivity from '@/components/home/RecentActivity';
import LogWeightModal from '@/components/home/LogWeightModal';

export default function HomePage() {
  const { profile } = useAuth();
  const { isWorkoutActive, startWorkout, setIsSheetOpen } = useWorkout();
  const [weightModalOpen, setWeightModalOpen] = useState(false);

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      {/* User summary */}
      <UserSummaryCard profile={profile} />

      {/* Quick stats */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Your stats
        </h3>
        <QuickStats profile={profile} />
      </section>

      {/* Start workout CTA / active workout banner */}
      {isWorkoutActive ? (
        <button
          onClick={() => setIsSheetOpen(true)}
          className="w-full rounded-xl border border-primary/30 bg-primary/5 py-4 text-sm text-muted-foreground text-center active:bg-primary/10 transition-colors"
        >
          Workout in progress — tap the bar above to return
        </button>
      ) : (
        <Button
          size="lg"
          className="w-full font-bold text-base"
          onClick={() => startWorkout()}
        >
          Start Workout
        </Button>
      )}

      {/* Recent activity */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Recent activity
        </h3>
        <RecentActivity />
      </section>

      {/* Log weight */}
      <Button
        variant="outline"
        className="w-full border-border text-muted-foreground gap-2"
        onClick={() => setWeightModalOpen(true)}
      >
        <Scale className="h-4 w-4" />
        Log Weight
      </Button>

      <LogWeightModal
        open={weightModalOpen}
        onOpenChange={setWeightModalOpen}
        unit={profile.weight_unit}
      />
    </div>
  );
}
