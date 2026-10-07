import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_RIDER_PRIVACY_PREFS,
  pickPrivacyPrefs,
  resolveLocationAccess,
} from '@/lib/privacy-preferences';

describe('rider privacy defaults', () => {
  it('location sharing and profile visibility are opt-out, personalised ads opt-in', () => {
    expect(DEFAULT_RIDER_PRIVACY_PREFS).toEqual({ locationSharing: true, personalizedAds: false, profileVisibility: true });
  });

  it('pickPrivacyPrefs keeps stored booleans and defaults anything missing', () => {
    expect(pickPrivacyPrefs(null)).toEqual(DEFAULT_RIDER_PRIVACY_PREFS);
    expect(pickPrivacyPrefs({ locationSharing: false })).toEqual({ ...DEFAULT_RIDER_PRIVACY_PREFS, locationSharing: false });
    expect(
      pickPrivacyPrefs({ personalizedAds: 'yes' as unknown as boolean, profileVisibility: false })
    ).toEqual({ locationSharing: true, personalizedAds: false, profileVisibility: false });
  });
});

describe('resolveLocationAccess', () => {
  const rider = { authLoading: false, isSignedInRider: true, prefsLoaded: true, locationSharing: true };

  it('waits while auth or the rider preference is still loading', () => {
    expect(resolveLocationAccess({ ...rider, authLoading: true })).toBe('wait');
    expect(resolveLocationAccess({ ...rider, prefsLoaded: false })).toBe('wait');
  });

  it('honours a signed-in rider’s Location Sharing toggle', () => {
    expect(resolveLocationAccess(rider)).toBe('allowed');
    expect(resolveLocationAccess({ ...rider, locationSharing: false })).toBe('disabled');
  });

  it('allows location when no rider is signed in', () => {
    expect(resolveLocationAccess({ ...rider, isSignedInRider: false, prefsLoaded: false, locationSharing: false })).toBe('allowed');
  });
});

describe('rider privacy migration', () => {
  const sql = fs.readFileSync(
    path.resolve(process.cwd(), 'database/schemas/supabase-schema-rider-privacy.sql'),
    'utf8'
  );

  it('makes location sharing and profile visibility default on', () => {
    expect(sql).toContain('alter column "locationSharing" set default true;');
    expect(sql).toContain('alter column "profileVisibility" set default true;');
    expect(sql).not.toMatch(/update\s+public\.rider_preferences/i);
  });

  it('withholds the photo when the rider hid it, only for drivers who can see the ride', () => {
    expect(sql).toContain('case when coalesce(p."profileVisibility", true) then u."photoURL" else null end');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = public');
    expect(sql).toMatch(/exists \(select 1 from public\.drivers d where d\."userId" = auth\.uid\(\)\)/);
    expect(sql).toContain('revoke all on function public.get_rider_photos_for_driver(uuid[]) from anon;');
  });
});

describe('privacy screen', () => {
  const screen = fs.readFileSync(path.resolve(process.cwd(), 'app/privacy.tsx'), 'utf8');

  it('no longer offers a Data Collection toggle (the app has no analytics)', () => {
    expect(screen).not.toContain('Data Collection');
    expect(screen).not.toContain("'dataCollection'");
  });
});
