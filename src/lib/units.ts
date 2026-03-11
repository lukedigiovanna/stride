import type { WeightUnit } from '@/types';

const KG_PER_LB = 0.453592;
const LB_PER_KG = 2.20462;

/** Convert pounds to kilograms, rounded to 2 decimal places. */
export const lbsToKg = (lbs: number): number =>
  Math.round(lbs * KG_PER_LB * 100) / 100;

/** Convert kilograms to pounds, rounded to 2 decimal places. */
export const kgToLbs = (kg: number): number =>
  Math.round(kg * LB_PER_KG * 100) / 100;

/**
 * Convert a weight value stored in lbs to the user's preferred display unit.
 * Returns the converted value without a unit label.
 */
export const fromLbs = (weightLbs: number, unit: WeightUnit): number =>
  unit === 'kg' ? lbsToKg(weightLbs) : weightLbs;

/**
 * Convert a weight value entered by the user in their preferred unit to lbs
 * for storage in the database.
 */
export const toLbs = (weight: number, unit: WeightUnit): number =>
  unit === 'kg' ? kgToLbs(weight) : weight;

/**
 * Format a weight value for display, including the unit label.
 * e.g. formatWeight(25, 'lbs') → '25 lbs'
 *      formatWeight(25, 'kg')  → '11.34 kg'
 */
export const formatWeight = (weightLbs: number, unit: WeightUnit): string => {
  const value = fromLbs(weightLbs, unit);
  // Show one decimal place only when there is a fractional part
  const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1);
  return `${formatted} ${unit}`;
};

/**
 * Format a weight value without the unit label — useful when the unit is
 * shown separately in the UI (e.g. as an input field suffix).
 */
export const formatWeightValue = (weightLbs: number, unit: WeightUnit): string => {
  const value = fromLbs(weightLbs, unit);
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
};
