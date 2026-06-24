/**
 * Returns the fiscal year string (e.g., "25-26") based on the Indian fiscal year
 * calendar (April to March). Accepts an optional custom date string.
 */
export const getFiscalYear = (customDateStr?: string): string => {
  const d = customDateStr ? new Date(customDateStr) : new Date();
  const m = d.getMonth();
  const y = d.getFullYear();
  const startYr = m >= 3 ? y : y - 1;
  const endYr = startYr + 1;
  return `${String(startYr).slice(-2)}-${String(endYr).slice(-2)}`;
};
