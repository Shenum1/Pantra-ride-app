/**
 * Formats a driver/rider rating for display: rounded to at most one decimal place,
 * with no trailing ".0" (4 -> "4", 4.25 -> "4.3", 3.5 -> "3.5"). A missing, invalid or
 * effectively-zero rating (a new account with no rated trips) shows as "0".
 */
export function formatRating(value: number | string | null | undefined): string {
  if (value == null) return '0';
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return '0';
  return String(Math.round(rating * 10) / 10);
}
