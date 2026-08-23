// Time-of-day / event pricing multiplier — separate signal from surge
// (surge reacts to the live online-driver/pending-ride ratio; this reacts to
// a scheduled or date-bound window, e.g. rush hour, a holiday, a concert).
// Rules are additive-migration data in `traffic_multiplier_rules`, fetched
// in useRideStore and combined with surge by multiplying both into the fare
// (see calculateFareBreakdown's `trafficMultiplier` param).
export interface TrafficRule {
  id: string;
  label: string;
  // 0=Sunday..6=Saturday. null/empty = applies every day.
  daysOfWeek: number[] | null;
  // Minutes since local midnight (0-1439). Both null = applies all day.
  // If startMinute > endMinute the window wraps past midnight.
  startMinute: number | null;
  endMinute: number | null;
  // Absolute date-range override for one-off events (concerts, holidays).
  // Either/both may be null to leave that side unbounded.
  startDate: string | null;
  endDate: string | null;
  multiplier: number;
  isEnabled: boolean;
}

function isRuleActive(date: Date, rule: TrafficRule): boolean {
  if (rule.startDate && date < new Date(rule.startDate)) {
    return false;
  }
  if (rule.endDate && date > new Date(rule.endDate)) {
    return false;
  }

  if (rule.daysOfWeek && rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(date.getDay())) {
    return false;
  }

  if (rule.startMinute != null && rule.endMinute != null) {
    const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes();
    const wraps = rule.startMinute > rule.endMinute;
    const inWindow = wraps
      ? minutesSinceMidnight >= rule.startMinute || minutesSinceMidnight <= rule.endMinute
      : minutesSinceMidnight >= rule.startMinute && minutesSinceMidnight <= rule.endMinute;
    if (!inWindow) {
      return false;
    }
  }

  return true;
}

// Takes the MAX of all active rules rather than stacking them multiplicatively
// — e.g. rush hour + rain both active shouldn't compound into a runaway fare.
export function calculateTrafficMultiplier(date: Date, rules: TrafficRule[]): number {
  let result = 1;
  for (const rule of rules) {
    if (!rule.isEnabled) continue;
    if (!isRuleActive(date, rule)) continue;
    result = Math.max(result, rule.multiplier);
  }
  return result;
}
