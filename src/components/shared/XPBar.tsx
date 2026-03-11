import type { GamificationState } from '@/types';

interface XPBarProps {
  gamification: GamificationState;
  /** Show xp counts below the bar. Defaults to true. */
  showLabel?: boolean;
}

/**
 * Amber gradient progress bar representing XP progress within the current level.
 * Fill proportion = xpIntoCurrentLevel / xpRequiredForNextLevel.
 */
export default function XPBar({ gamification, showLabel = true }: XPBarProps) {
  const { xpIntoCurrentLevel, xpRequiredForNextLevel } = gamification;
  const pct = xpRequiredForNextLevel > 0
    ? Math.min(1, xpIntoCurrentLevel / xpRequiredForNextLevel)
    : 1;

  return (
    <div className="w-full space-y-1">
      {/* Track */}
      <div className="h-2 w-full rounded-full bg-border overflow-hidden">
        {/* Fill */}
        <div
          className="h-full rounded-full"
          style={{
            width: `${(pct * 100).toFixed(1)}%`,
            background: 'linear-gradient(90deg, var(--xp-start), var(--xp-end))',
          }}
        />
      </div>

      {showLabel && (
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>{xpIntoCurrentLevel.toLocaleString()} XP</span>
          <span>{xpRequiredForNextLevel.toLocaleString()} XP</span>
        </div>
      )}
    </div>
  );
}
