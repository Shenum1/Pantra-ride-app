// Watch-a-rewarded-ad-to-earn-points constants. Enforced server-side only
// (backend/trpc/routes/rewards/claim-ad-reward/route.ts) — never trust a
// client-supplied point amount or daily count for this ledger.
export const AD_REWARD_POINTS = 20;
export const AD_REWARD_DAILY_CAP = 5;

export function canClaimAdReward(countToday: number): boolean {
  return countToday < AD_REWARD_DAILY_CAP;
}
