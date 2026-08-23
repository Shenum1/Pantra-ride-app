import { describe, expect, it } from 'vitest';
import { AD_REWARD_POINTS, AD_REWARD_DAILY_CAP, canClaimAdReward } from '@/lib/ad-rewards-config';

describe('ad-rewards-config', () => {
  it('exposes the agreed points-per-ad and daily cap', () => {
    expect(AD_REWARD_POINTS).toBe(20);
    expect(AD_REWARD_DAILY_CAP).toBe(5);
  });

  it('allows claiming below the daily cap', () => {
    expect(canClaimAdReward(0)).toBe(true);
    expect(canClaimAdReward(AD_REWARD_DAILY_CAP - 1)).toBe(true);
  });

  it('blocks claiming at or above the daily cap', () => {
    expect(canClaimAdReward(AD_REWARD_DAILY_CAP)).toBe(false);
    expect(canClaimAdReward(AD_REWARD_DAILY_CAP + 1)).toBe(false);
  });
});
