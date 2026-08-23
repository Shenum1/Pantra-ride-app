import { describe, expect, it } from 'vitest';
import { calculateTrafficMultiplier, TrafficRule } from '@/lib/traffic-multiplier';

function baseRule(overrides: Partial<TrafficRule> = {}): TrafficRule {
  return {
    id: 'rule-1',
    label: 'Test rule',
    daysOfWeek: null,
    startMinute: null,
    endMinute: null,
    startDate: null,
    endDate: null,
    multiplier: 1.2,
    isEnabled: true,
    ...overrides,
  };
}

describe('calculateTrafficMultiplier', () => {
  it('returns 1 when there are no rules', () => {
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 8, 0), [])).toBe(1);
  });

  it('ignores a disabled rule', () => {
    const rule = baseRule({ isEnabled: false, multiplier: 2 });
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 8, 0), [rule])).toBe(1);
  });

  it('applies a rule with no day/time restriction at any time', () => {
    const rule = baseRule({ multiplier: 1.5 });
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 3, 0), [rule])).toBe(1.5);
  });

  it('applies a rule inside its minute window and not outside it', () => {
    // 07:00-09:30 window
    const rule = baseRule({ startMinute: 420, endMinute: 570, multiplier: 1.2 });
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 8, 0), [rule])).toBe(1.2);
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 11, 0), [rule])).toBe(1);
  });

  it('handles a window that wraps past midnight', () => {
    // 22:00-02:00 window
    const rule = baseRule({ startMinute: 22 * 60, endMinute: 2 * 60, multiplier: 1.4 });
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 23, 0), [rule])).toBe(1.4);
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 1, 0), [rule])).toBe(1.4);
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 12, 0), [rule])).toBe(1);
  });

  it('only applies on the configured days of week', () => {
    const reference = new Date(2026, 7, 10, 8, 0);
    const sameDay = baseRule({ daysOfWeek: [reference.getDay()], multiplier: 1.2 });
    const otherDay = baseRule({ daysOfWeek: [(reference.getDay() + 1) % 7], multiplier: 1.2 });

    expect(calculateTrafficMultiplier(reference, [sameDay])).toBe(1.2);
    expect(calculateTrafficMultiplier(reference, [otherDay])).toBe(1);
  });

  it('respects an absolute startDate/endDate range for one-off events', () => {
    const rule = baseRule({
      startDate: new Date(2026, 7, 10, 0, 0).toISOString(),
      endDate: new Date(2026, 7, 12, 23, 59).toISOString(),
      multiplier: 1.4,
    });
    expect(calculateTrafficMultiplier(new Date(2026, 7, 11, 12, 0), [rule])).toBe(1.4);
    expect(calculateTrafficMultiplier(new Date(2026, 7, 15, 12, 0), [rule])).toBe(1);
  });

  it('takes the MAX of multiple active rules, not a stacked product', () => {
    const rushHour = baseRule({ id: 'rush', multiplier: 1.2 });
    const rain = baseRule({ id: 'rain', multiplier: 1.25 });
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 8, 0), [rushHour, rain])).toBe(1.25);
  });

  it('never returns less than 1', () => {
    const rule = baseRule({ multiplier: 0.5 });
    expect(calculateTrafficMultiplier(new Date(2026, 7, 10, 8, 0), [rule])).toBe(1);
  });
});
