import type { GamificationState } from '@/types';

// ─── XP Thresholds ───────────────────────────────────────────────────────────

/**
 * Cumulative XP required to *reach* each level.
 * Index 0 = Level 1 (requires 0 XP), index 1 = Level 2 (requires 100 XP), etc.
 *
 * The curve accelerates gradually so early levels feel achievable while
 * high levels represent genuine long-term commitment.
 */
export const LEVEL_THRESHOLDS: number[] = [
  0,       // Level 1
  100,     // Level 2
  250,     // Level 3
  500,     // Level 4
  900,     // Level 5
  1_400,   // Level 6
  2_000,   // Level 7
  2_700,   // Level 8
  3_500,   // Level 9
  4_500,   // Level 10
  5_700,   // Level 11
  7_100,   // Level 12
  8_700,   // Level 13
  10_500,  // Level 14
  12_500,  // Level 15
  15_000,  // Level 16
  17_800,  // Level 17
  21_000,  // Level 18
  24_500,  // Level 19
  28_500,  // Level 20
  33_000,  // Level 21
  38_000,  // Level 22
  43_500,  // Level 23
  49_500,  // Level 24
  56_000,  // Level 25
  63_000,  // Level 26
  70_500,  // Level 27
  78_500,  // Level 28
  87_000,  // Level 29
  96_000,  // Level 30
  // Levels 31–50: ~10k XP per level
  106_000, 117_000, 129_000, 142_000, 156_000,
  171_000, 187_000, 204_000, 222_000, 241_000,
  261_000, 282_000, 304_000, 327_000, 351_000,
  376_000, 402_000, 429_000, 457_000, 486_000,
  // Levels 51–70: ~15k XP per level
  516_000, 546_000, 576_000, 606_000, 636_000,
  666_000, 696_000, 726_000, 756_000, 786_000,
  816_000, 846_000, 876_000, 906_000, 936_000,
  966_000, 996_000, 1_026_000, 1_056_000, 1_086_000,
  // Levels 71–100: ~20k XP per level (prestige territory)
  1_116_000, 1_136_000, 1_156_000, 1_176_000, 1_196_000,
  1_216_000, 1_236_000, 1_256_000, 1_276_000, 1_296_000,
  1_316_000, 1_336_000, 1_356_000, 1_376_000, 1_396_000,
  1_416_000, 1_436_000, 1_456_000, 1_476_000, 1_496_000,
  1_516_000, 1_536_000, 1_556_000, 1_576_000, 1_596_000,
  1_616_000, 1_636_000, 1_656_000, 1_676_000, 1_696_000,
];

// ─── Rank Titles ─────────────────────────────────────────────────────────────

export interface Rank {
  /** The first level at which this rank is awarded. */
  minLevel: number;
  title: string;
}

/**
 * Rank titles in ascending order. A user holds the highest rank whose
 * minLevel is ≤ their current level.
 */
export const RANKS: Rank[] = [
  { minLevel: 1,   title: 'Pipsqueak'   },
  { minLevel: 5,   title: 'Rookie'      },
  { minLevel: 10,  title: 'Amateur'     },
  { minLevel: 20,  title: 'Contender'   },
  { minLevel: 35,  title: 'Lifter'      },
  { minLevel: 50,  title: 'Iron'        },
  { minLevel: 65,  title: 'Beast'       },
  { minLevel: 80,  title: 'Apex'        },
  { minLevel: 100, title: 'Silverback'  },
];

// ─── XP Calculation ──────────────────────────────────────────────────────────

/**
 * XP earned for a single strength or bodyweight set.
 * Formula: floor(weight_lbs × reps / 10)
 *
 * Examples:
 *   25 lbs × 12 reps → 30 XP
 *   135 lbs × 5 reps → 67 XP
 */
export const calcStrengthSetXP = (weightLbs: number, reps: number): number =>
  Math.floor((weightLbs * reps) / 10);

/**
 * XP earned for a single cardio set.
 * Formula: floor(distance × duration / 5)
 *
 * Examples:
 *   1.5 mi × 18 min → 5 XP
 *   3.0 mi × 30 min → 18 XP
 */
export const calcCardioSetXP = (distance: number, durationMinutes: number): number =>
  Math.floor((distance * durationMinutes) / 5);

// ─── Level / Rank Derivation ─────────────────────────────────────────────────

/**
 * Returns the level (1-indexed) that corresponds to the given cumulative XP.
 * If XP exceeds all defined thresholds, returns the maximum defined level.
 */
export const getLevelFromXP = (totalXp: number): number => {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
};

/**
 * Returns the rank title for a given level.
 * Always returns at least 'Pipsqueak' (the level 1 rank).
 */
export const getRankForLevel = (level: number): string => {
  let rank = RANKS[0].title;
  for (const r of RANKS) {
    if (level >= r.minLevel) rank = r.title;
    else break;
  }
  return rank;
};

/**
 * Returns the next rank title and the level at which it unlocks,
 * or null if the user is already at the highest rank.
 */
export const getNextRank = (level: number): Rank | null => {
  for (const r of RANKS) {
    if (r.minLevel > level) return r;
  }
  return null;
};

/**
 * Derives the full GamificationState from a cumulative XP value.
 * This is the single source of truth for level, rank, and XP bar calculations.
 */
export const getGamificationState = (totalXp: number): GamificationState => {
  const currentLevel = getLevelFromXP(totalXp);
  const currentRank = getRankForLevel(currentLevel);
  const nextRankEntry = getNextRank(currentLevel);

  // XP at the start and end of the current level band
  const currentLevelThreshold = LEVEL_THRESHOLDS[currentLevel - 1] ?? 0;
  const nextLevelThreshold = LEVEL_THRESHOLDS[currentLevel] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  const xpIntoCurrentLevel = totalXp - currentLevelThreshold;
  const xpRequiredForNextLevel = nextLevelThreshold - currentLevelThreshold;

  return {
    totalXp,
    currentLevel,
    currentRank,
    xpIntoCurrentLevel,
    xpRequiredForNextLevel,
    nextRank: nextRankEntry?.title ?? null,
  };
};
