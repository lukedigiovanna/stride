/**
 * Tiny single-slot callback bridge used to coordinate between the
 * LevelUpOverlay (which fires on profile XP change) and WorkoutSheet
 * (which wants to show the summary modal after the overlay dismisses).
 *
 * Usage:
 *   WorkoutSheet — before finishing, if a global level-up will occur:
 *     levelUpBridge.register(() => setSummaryOpen(true))
 *   LevelUpOverlay — when user taps "Keep going":
 *     levelUpBridge.fire()
 */
let pending: (() => void) | null = null;

export const levelUpBridge = {
  register: (cb: () => void) => { pending = cb; },
  fire: () => { pending?.(); pending = null; },
  /** True if a callback is waiting — lets the overlay skip firing if nothing registered. */
  hasPending: () => pending !== null,
};
