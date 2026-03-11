import type { Profile } from '@/types';
import { getGamificationState } from '@/lib/xp';
import XPBar from '@/components/shared/XPBar';

interface UserSummaryCardProps {
  profile: Profile;
}

export default function UserSummaryCard({ profile }: UserSummaryCardProps) {
  const gam = getGamificationState(profile.total_xp);

  return (
    <div className="rounded-xl bg-surface border border-border p-4 space-y-3">
      {/* Name + rank row */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground leading-tight">
            {profile.display_name ?? 'Athlete'}
          </h2>
          <p className="text-sm text-primary font-medium">{gam.currentRank}</p>
        </div>

        {/* Level badge */}
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Level</span>
          <span className="text-2xl font-extrabold text-foreground tabular-nums leading-none">
            {gam.currentLevel}
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div>
        <XPBar gamification={gam} />
        {gam.nextRank && (
          <p className="mt-1 text-[10px] text-muted-foreground text-right">
            Next rank: <span className="text-primary">{gam.nextRank}</span>
          </p>
        )}
      </div>
    </div>
  );
}
