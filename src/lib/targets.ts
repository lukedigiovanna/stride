import type { ExerciseTarget } from '@/types';

/** Format a duration in seconds as a compact string, e.g. 90 → "1m30s". */
export function formatRestSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${s}s`;
  if (rem === 0) return `${m}m`;
  return `${m}m${rem}s`;
}

export function formatSetRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    if (min === max) return min === 1 ? '1 set' : `${min} sets`;
    return `${min}-${max} sets`;
  }
  if (min !== null) return `≥${min} sets`;
  return `≤${max} sets`;
}

export function formatRepRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    if (min === max) return min === 1 ? '1 rep' : `${min} reps`;
    return `${min}-${max} reps`;
  }
  if (min !== null) return `≥${min} reps`;
  return `≤${max} reps`;
}

export function formatRestRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    if (min === max) return `${formatRestSeconds(min)} rest`;
    return `${formatRestSeconds(min)}-${formatRestSeconds(max)} rest`;
  }
  if (min !== null) return `≥${formatRestSeconds(min)} rest`;
  return `≤${formatRestSeconds(max!)} rest`;
}

/**
 * Build a compact single-line hint from an ExerciseTarget, e.g.
 * "3–4 sets · 8–12 reps · 1m–1m 30s rest"
 * Returns null if no targets are set.
 */
export function buildTargetHint(target: ExerciseTarget): string | null {
  const parts = [
    formatSetRange(target.target_sets_min, target.target_sets_max),
    formatRepRange(target.target_reps_min, target.target_reps_max),
    formatRestRange(target.target_rest_seconds_min, target.target_rest_seconds_max),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ·  ') : null;
}
