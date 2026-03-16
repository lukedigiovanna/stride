import { motion } from 'framer-motion';
import type { GamificationState } from '@/types';

interface XPBarProps {
  gamification: GamificationState;
  showLabel?: boolean;
}

/**
 * Amber gradient progress bar. Fill animates with a spring whenever
 * xpIntoCurrentLevel changes.
 */
export default function XPBar({ gamification, showLabel = true }: XPBarProps) {
  const { xpIntoCurrentLevel, xpRequiredForNextLevel } = gamification;
  const pct = xpRequiredForNextLevel > 0
    ? Math.min(1, xpIntoCurrentLevel / xpRequiredForNextLevel)
    : 1;

  return (
    <div className="w-full space-y-1">
      <div className="h-2 w-full rounded-none bg-border overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(pct * 100).toFixed(2)}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 1 }}
          style={{ background: 'linear-gradient(90deg, var(--xp-start), var(--xp-end))' }}
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
