import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { getLevelFromXP, getRankForLevel } from '@/lib/xp';
import { levelUpBridge } from '@/lib/levelUpBridge';

interface LevelUpData {
  newLevel: number;
  newRank: string;
  rankChanged: boolean;
}

/**
 * Full-screen overlay that fires whenever profile.total_xp crosses a level
 * threshold. Uses Framer Motion for the entrance animation sequence.
 *
 * After the user taps "Keep going", fires levelUpBridge.fire() so WorkoutSheet
 * can show the post-workout summary modal immediately after.
 */
export default function LevelUpOverlay() {
  const { profile } = useAuth();
  const prevLevelRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [data, setData] = useState<LevelUpData | null>(null);

  useEffect(() => {
    if (!profile) return;
    const newLevel = getLevelFromXP(profile.total_xp);

    if (prevLevelRef.current === null) {
      // First load — initialise without showing
      prevLevelRef.current = newLevel;
      return;
    }

    if (newLevel > prevLevelRef.current) {
      const prevLevel = prevLevelRef.current;
      const newRank = getRankForLevel(newLevel);
      const prevRank = getRankForLevel(prevLevel);
      setData({ newLevel, newRank, rankChanged: newRank !== prevRank });
      setIsVisible(true);
    }

    prevLevelRef.current = newLevel;
  }, [profile?.total_xp]);

  function handleDismiss() {
    setIsVisible(false);
    levelUpBridge.fire();
  }

  return (
    <AnimatePresence>
      {isVisible && data && (
        <motion.div
          key="level-up-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/97 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(15,15,20,0.97)' }}
        >
          {/* "LEVEL UP" label */}
          <motion.p
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 16 }}
            className="text-lg font-black uppercase tracking-[0.25em] text-primary"
          >
            Level Up!
          </motion.p>

          {/* Level number */}
          <motion.p
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 160, damping: 18 }}
            className="text-[7rem] font-black text-foreground tabular-nums leading-none mt-2"
          >
            {data.newLevel}
          </motion.p>

          {/* Rank title */}
          <motion.p
            initial={{ y: 24, opacity: 0 }}
            animate={
              data.rankChanged
                ? {
                    y: [24, 0, 0, 0],
                    opacity: [0, 1, 1, 1],
                    scale: [1, 1, 1.08, 1],
                    color: ['#F5F0E8', '#F5F0E8', '#F59E0B', '#F59E0B'],
                  }
                : { y: 0, opacity: 1 }
            }
            transition={{ delay: 0.7, duration: 0.8 }}
            className="text-2xl font-bold mt-1"
          >
            {data.newRank}
          </motion.p>

          {data.rankChanged && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="text-xs text-primary font-medium tracking-wider uppercase mt-1"
            >
              New rank unlocked
            </motion.p>
          )}

          {/* Dismiss button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            onClick={handleDismiss}
            className="mt-14 px-10 py-3 rounded-full bg-primary text-primary-foreground font-bold text-base active:opacity-80 transition-opacity"
          >
            Keep going
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
