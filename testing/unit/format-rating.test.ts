import { describe, expect, it } from 'vitest';
import { formatRating } from '@/lib/format-rating';

describe('formatRating', () => {
  it('shows 0 for a new account with no rating', () => {
    expect(formatRating(null)).toBe('0');
    expect(formatRating(undefined)).toBe('0');
    expect(formatRating(0)).toBe('0');
  });

  it('rounds tiny or invalid values to 0', () => {
    expect(formatRating(0.0007)).toBe('0');
    expect(formatRating('not a number')).toBe('0');
    expect(formatRating(-1)).toBe('0');
  });

  it('keeps at most one decimal place and drops a trailing .0', () => {
    expect(formatRating(1)).toBe('1');
    expect(formatRating(1.5)).toBe('1.5');
    expect(formatRating(2.3333)).toBe('2.3');
    expect(formatRating(4.96)).toBe('5');
    expect(formatRating('4.25')).toBe('4.3');
  });
});
