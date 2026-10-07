import { describe, expect, it } from 'vitest';
import {
  AdConsentState,
  buildAdRequestOptions,
  canServeAds,
  consentAllowsPersonalisation,
  INITIAL_AD_CONSENT_STATE,
  normaliseConsentStatus,
  normaliseTrackingStatus,
  parseDebugGeography,
  parseTestDeviceIds,
  shouldRequestTracking,
} from '@/lib/ad-consent-policy';

const consent = (changes: Partial<AdConsentState> = {}): AdConsentState => ({
  ...INITIAL_AD_CONSENT_STATE,
  gathered: true,
  status: 'NOT_REQUIRED',
  canRequestAds: true,
  sdkInitialized: true,
  tracking: 'not-applicable',
  ...changes,
});

const options = (personalizedAdsPreference: boolean, c: AdConsentState, preferenceLoaded = true) =>
  buildAdRequestOptions({ personalizedAdsPreference, preferenceLoaded, consent: c });

describe('canServeAds', () => {
  it('blocks every ad request until the UMP flow has run and the SDK is initialised', () => {
    expect(canServeAds(INITIAL_AD_CONSENT_STATE)).toBe(false);
    expect(canServeAds(consent({ gathered: false }))).toBe(false);
    expect(canServeAds(consent({ sdkInitialized: false }))).toBe(false);
    expect(canServeAds(consent({ canRequestAds: false }))).toBe(false);
    expect(canServeAds(consent())).toBe(true);
  });
});

describe('buildAdRequestOptions', () => {
  it('is personalised only when the rider opted in and consent allows it', () => {
    expect(options(true, consent())).toEqual({ requestNonPersonalizedAdsOnly: false });
    expect(options(true, consent({ status: 'OBTAINED' }))).toEqual({ requestNonPersonalizedAdsOnly: false });
  });

  it('is non-personalised when the Personalized Ads toggle is off', () => {
    expect(options(false, consent())).toEqual({ requestNonPersonalizedAdsOnly: true });
  });

  it('is non-personalised while the rider preference has not loaded', () => {
    expect(options(true, consent(), false).requestNonPersonalizedAdsOnly).toBe(true);
  });

  it('is non-personalised when consent is not obtained', () => {
    expect(options(true, consent({ status: 'REQUIRED' })).requestNonPersonalizedAdsOnly).toBe(true);
    expect(options(true, consent({ status: 'UNKNOWN' })).requestNonPersonalizedAdsOnly).toBe(true);
    expect(options(true, consent({ gathered: false })).requestNonPersonalizedAdsOnly).toBe(true);
    expect(options(true, consent({ canRequestAds: false })).requestNonPersonalizedAdsOnly).toBe(true);
  });

  it('is non-personalised when the UMP form answer declined personalised ads', () => {
    expect(options(true, consent({ status: 'OBTAINED', personalisationConsented: false })).requestNonPersonalizedAdsOnly).toBe(true);
    expect(options(true, consent({ status: 'OBTAINED', personalisationConsented: true })).requestNonPersonalizedAdsOnly).toBe(false);
  });

  it('on iOS needs App Tracking Transparency granted', () => {
    expect(options(true, consent({ tracking: 'granted' })).requestNonPersonalizedAdsOnly).toBe(false);
    for (const tracking of ['denied', 'undetermined', 'unavailable'] as const) {
      expect(options(true, consent({ tracking })).requestNonPersonalizedAdsOnly, tracking).toBe(true);
    }
  });
});

describe('consentAllowsPersonalisation', () => {
  it('treats Android (no ATT) with no consent requirement as allowed', () => {
    expect(consentAllowsPersonalisation(consent())).toBe(true);
  });
  it('defaults to not allowed before anything is known', () => {
    expect(consentAllowsPersonalisation(INITIAL_AD_CONSENT_STATE)).toBe(false);
  });
});

describe('shouldRequestTracking', () => {
  const base = { platform: 'ios', personalizedAdsPreference: true, consent: consent({ tracking: 'undetermined' }) };

  it('asks on iOS when the rider wants personalised ads and has never answered', () => {
    expect(shouldRequestTracking(base)).toBe(true);
  });

  it('never asks riders who did not opt into personalised ads', () => {
    expect(shouldRequestTracking({ ...base, personalizedAdsPreference: false })).toBe(false);
  });

  it('never asks on Android, before UMP finished, when ads are blocked, or twice', () => {
    expect(shouldRequestTracking({ ...base, platform: 'android' })).toBe(false);
    expect(shouldRequestTracking({ ...base, consent: consent({ tracking: 'undetermined', gathered: false }) })).toBe(false);
    expect(shouldRequestTracking({ ...base, consent: consent({ tracking: 'undetermined', canRequestAds: false }) })).toBe(false);
    expect(shouldRequestTracking({ ...base, consent: consent({ tracking: 'denied' }) })).toBe(false);
    expect(shouldRequestTracking({ ...base, consent: consent({ tracking: 'granted' }) })).toBe(false);
  });
});

describe('normalisers and env parsing', () => {
  it('normalises UMP and ATT statuses', () => {
    expect(normaliseConsentStatus('OBTAINED')).toBe('OBTAINED');
    expect(normaliseConsentStatus('weird')).toBe('UNKNOWN');
    expect(normaliseConsentStatus(undefined)).toBe('UNKNOWN');
    expect(normaliseTrackingStatus('granted')).toBe('granted');
    expect(normaliseTrackingStatus('restricted')).toBe('unavailable');
  });

  it('parses test device ids', () => {
    expect(parseTestDeviceIds(undefined)).toEqual([]);
    expect(parseTestDeviceIds('')).toEqual([]);
    expect(parseTestDeviceIds(' ABC123 , DEF456\nGHI ')).toEqual(['ABC123', 'DEF456', 'GHI']);
  });

  it('parses the debug geography', () => {
    expect(parseDebugGeography('eea')).toBe('EEA');
    expect(parseDebugGeography('REGULATED_US_STATE')).toBe('REGULATED_US_STATE');
    expect(parseDebugGeography('nigeria')).toBeNull();
    expect(parseDebugGeography(undefined)).toBeNull();
  });
});
