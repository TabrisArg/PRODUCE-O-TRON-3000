/**
 * Global Unit Conversion Settings
 * These constants define the relationship between time-based effort units.
 * 1 Month = 20 Days
 * 1 Day = 8 Hours
 */

export const CONVERSIONS = {
  DAYS_PER_MONTH: 20,
  HOURS_PER_DAY: 8,
};

export const RATIOS = {
  MONTH_TO_MONTH: 1,
  MONTH_TO_DAYS: CONVERSIONS.DAYS_PER_MONTH,
  MONTH_TO_HOURS: CONVERSIONS.DAYS_PER_MONTH * CONVERSIONS.HOURS_PER_DAY,
  
  // Reciprocals for ratioToMonth calculation
  DAYS_TO_MONTH: 1 / CONVERSIONS.DAYS_PER_MONTH,
  HOURS_TO_MONTH: 1 / (CONVERSIONS.DAYS_PER_MONTH * CONVERSIONS.HOURS_PER_DAY),
};
