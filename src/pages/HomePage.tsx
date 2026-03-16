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
    <div className="flex flex-col pb-4">
      {/* User summary */}
      <div className="px-4 pt-6 pb-4">
        <UserSummaryCard profile={profile} />
      </div>

      {/* Quick stats — full-width ruled rows */}
      <section>
        <div className="flex items-center px-4 h-9 border-b border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your stats</h3>
        </div>
        <QuickStats profile={profile} />
      </section>

      {/* Start workout CTA / active workout banner */}
      <div className="px-4 py-4 border-b border-border">
        {isWorkoutActive ? (
          <button
            onClick={() => setIsSheetOpen(true)}
            className="w-full rounded-sm border border-foreground/20 bg-surface py-3 text-sm text-muted-foreground text-center active:bg-foreground/8 transition-colors"
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
      </div>

      {/* Recent activity — full-width ruled rows */}
      <section>
        <div className="flex items-center px-4 h-9 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recent activity</h3>
        </div>
        <RecentActivity />
      </section>

      {/* Log weight */}
      <div className="px-4 pt-4">
        <Button
          variant="outline"
          className="w-full border-border text-muted-foreground gap-2"
          onClick={() => setWeightModalOpen(true)}
        >
          <Scale className="h-4 w-4" />
          Log Weight
        </Button>
      </div>

      <LogWeightModal
        open={weightModalOpen}
        onOpenChange={setWeightModalOpen}
        unit={profile.weight_unit}
      />
    </div>
  );
}
