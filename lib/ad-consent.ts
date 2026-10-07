import { Platform } from 'react-native';
import { usePrivacyStore } from '@/hooks/usePrivacyStore';
import {
  AdConsentState,
  canServeAds,
  normaliseConsentStatus,
  normaliseTrackingStatus,
  parseDebugGeography,
  parseTestDeviceIds,
  TrackingStatus,
} from '@/lib/ad-consent-policy';

// Google UMP (User Messaging Platform) consent + iOS App Tracking Transparency,
// run once per app launch by components/PrivacyBootstrap.tsx BEFORE the first
// ad request. Ads (components/AdBanner.tsx, hooks/useRewardedAd.ts) wait for
// canServeAds() — i.e. this flow finished, UMP allows ads and
// mobileAds().initialize() has completed.
//
// The web build uses lib/ad-consent.web.ts instead: react-native-google-mobile-ads
// has no web build and Metro resolves require() statically (see AdBanner.web.tsx).
//
// Testing the consent form on a device (optional env vars):
//   EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS=<hashed id from the device log>[,<id>...]
//   EXPO_PUBLIC_ADMOB_CONSENT_DEBUG_GEOGRAPHY=EEA   (or NOT_EEA / REGULATED_US_STATE / OTHER)
// UMP only honours the debug geography on registered test devices (emulators
// and simulators always count as test devices), so these are inert for real users.

/* eslint-disable @typescript-eslint/no-require-imports */

let gatherPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;

function ads(): any {
  return require('react-native-google-mobile-ads');
}

function trackingModule(): any | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('expo-tracking-transparency');
  } catch {
    return null;
  }
}

function setConsent(changes: Partial<AdConsentState>) {
  usePrivacyStore.getState().setConsent(changes);
}

async function readTrackingStatus(): Promise<TrackingStatus> {
  if (Platform.OS !== 'ios') return 'not-applicable';
  const tt = trackingModule();
  if (!tt) return 'unavailable';
  try {
    if (typeof tt.isAvailable === 'function' && !tt.isAvailable()) return 'unavailable';
    const { status } = await tt.getTrackingPermissionsAsync();
    return normaliseTrackingStatus(status);
  } catch (error) {
    console.warn('ad-consent: unable to read ATT status', error);
    return 'unavailable';
  }
}

async function readPersonalisationConsent(status: string): Promise<boolean | null> {
  if (status !== 'OBTAINED') return null;
  try {
    const { AdsConsent } = ads();
    const gdprApplies = await AdsConsent.getGdprApplies();
    if (!gdprApplies) return null;
    const choices = await AdsConsent.getUserChoices();
    return !!choices.selectPersonalisedAds;
  } catch (error) {
    console.warn('ad-consent: unable to read UMP user choices', error);
    // Conservative: an unreadable TCF answer is treated as "no personalisation".
    return false;
  }
}

async function applyConsentInfo(info: any) {
  const status = normaliseConsentStatus(info?.status);
  setConsent({
    status,
    canRequestAds: !!info?.canRequestAds,
    privacyOptionsRequired: info?.privacyOptionsRequirementStatus === 'REQUIRED',
    personalisationConsented: await readPersonalisationConsent(status),
  });
}

function initialiseSdkIfAllowed(): Promise<void> {
  const { consent } = usePrivacyStore.getState();
  if (!consent.canRequestAds) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mobileAds = ads().default;
        const testDeviceIdentifiers = parseTestDeviceIds(process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS);
        if (testDeviceIdentifiers.length > 0) {
          await mobileAds().setRequestConfiguration({ testDeviceIdentifiers });
        }
        await mobileAds().initialize();
        setConsent({ sdkInitialized: true });
      } catch (error) {
        console.error('ad-consent: mobileAds().initialize() failed', error);
        initPromise = null;
      }
    })();
  }
  return initPromise;
}

async function runConsentFlow() {
  const { AdsConsent, AdsConsentDebugGeography } = ads();
  const options: Record<string, unknown> = {};
  const testDeviceIdentifiers = parseTestDeviceIds(process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS);
  if (testDeviceIdentifiers.length > 0) options.testDeviceIdentifiers = testDeviceIdentifiers;
  const debugGeography = parseDebugGeography(process.env.EXPO_PUBLIC_ADMOB_CONSENT_DEBUG_GEOGRAPHY);
  if (debugGeography) options.debugGeography = AdsConsentDebugGeography[debugGeography];

  let info: any = null;
  try {
    await AdsConsent.requestInfoUpdate(options);
    // Shows the form only when UMP says it's required (e.g. EEA/UK users
    // without a stored decision); otherwise resolves immediately.
    info = await AdsConsent.loadAndShowConsentFormIfRequired();
  } catch (error) {
    console.warn('ad-consent: consent info update / form failed', error);
    // Per Google's guidance, fall back to the consent obtained in a previous
    // session — canRequestAds stays false if there is none.
    try {
      info = await AdsConsent.getConsentInfo();
    } catch {
      info = null;
    }
  }

  await applyConsentInfo(info);
  setConsent({ tracking: await readTrackingStatus() });
  await initialiseSdkIfAllowed();
  setConsent({ gathered: true });
}

/** Run the UMP flow once per app launch. Safe to call repeatedly. */
export function gatherAdConsent(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (!gatherPromise) {
    gatherPromise = runConsentFlow().catch((error) => {
      console.error('ad-consent: consent flow failed', error);
      setConsent({ gathered: true });
    });
  }
  return gatherPromise;
}

/** Re-open the UMP privacy options form (shown in Privacy settings when required). */
export async function showAdPrivacyOptions(): Promise<void> {
  const { AdsConsent } = ads();
  const info = await AdsConsent.showPrivacyOptionsForm();
  await applyConsentInfo(info);
  await initialiseSdkIfAllowed();
}

/**
 * iOS only: show the App Tracking Transparency prompt if it has never been
 * answered. Called when a rider with Personalized Ads on reaches the app (or
 * turns the toggle on); until it resolves ads stay non-personalised.
 */
export async function requestTrackingAuthorization(): Promise<TrackingStatus> {
  if (Platform.OS !== 'ios') return 'not-applicable';
  const tt = trackingModule();
  if (!tt) {
    setConsent({ tracking: 'unavailable' });
    return 'unavailable';
  }
  try {
    const { status } = await tt.requestTrackingPermissionsAsync();
    const tracking = normaliseTrackingStatus(status);
    setConsent({ tracking });
    return tracking;
  } catch (error) {
    console.warn('ad-consent: ATT request failed', error);
    setConsent({ tracking: 'unavailable' });
    return 'unavailable';
  }
}

/** Resolves true once ads may be requested, false if that didn't happen within timeoutMs. */
export async function waitForAdsReady(timeoutMs = 10000): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  void gatherAdConsent();
  if (canServeAds(usePrivacyStore.getState().consent)) return true;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const unsubscribe = usePrivacyStore.subscribe((state) => {
      if (canServeAds(state.consent)) finish(true);
      else if (state.consent.gathered && !state.consent.canRequestAds) finish(false);
    });
  });
}
