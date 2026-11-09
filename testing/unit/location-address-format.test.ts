import { describe, expect, it } from 'vitest';

import { formatReverseGeocodedAddress } from '@/lib/address-format';

describe('formatReverseGeocodedAddress', () => {
  it('joins street, area and city', () => {
    expect(formatReverseGeocodedAddress({
      name: 'Ahmadu Bello Way',
      street: 'Ahmadu Bello Way',
      district: 'Wuse 2',
      city: 'Abuja',
    })).toBe('Ahmadu Bello Way, Wuse 2, Abuja');
  });

  it('puts the house number in front of the street and drops it as a name', () => {
    expect(formatReverseGeocodedAddress({
      name: '12',
      streetNumber: '12',
      street: 'Aminu Kano Crescent',
      city: 'Abuja',
    })).toBe('12 Aminu Kano Crescent, Abuja');
  });

  it('keeps a feature name that is not the street (an estate, a building)', () => {
    expect(formatReverseGeocodedAddress({
      name: 'Sunnyvale Estate',
      street: 'Dakwo Road',
      district: 'Lokogoma',
      city: 'Abuja',
    })).toBe('Sunnyvale Estate, Dakwo Road, Lokogoma, Abuja');
  });

  it('never produces the old " , Abuja" output for empty fields', () => {
    expect(formatReverseGeocodedAddress({ street: null, name: '', district: 'Kubwa', city: 'Abuja' })).toBe('Kubwa, Abuja');
  });

  it('ignores plus codes the Android geocoder returns as names', () => {
    expect(formatReverseGeocodedAddress({ name: '8J2F+XQ', district: 'Garki', city: 'Abuja' })).toBe('Garki, Abuja');
  });

  it('falls back to subregion when the city is missing', () => {
    expect(formatReverseGeocodedAddress({ street: 'Mararaba Road', subregion: 'Karu' })).toBe('Mararaba Road, Karu');
  });

  it('returns null when only a city is known, so the caller shows "Current location"', () => {
    expect(formatReverseGeocodedAddress({ city: 'Abuja' })).toBeNull();
    expect(formatReverseGeocodedAddress({ name: '8J2F+XQ', city: 'Abuja' })).toBeNull();
    expect(formatReverseGeocodedAddress({})).toBeNull();
  });

  it('does not repeat a district that matches the city', () => {
    expect(formatReverseGeocodedAddress({ street: 'Lugbe Road', district: 'Abuja', city: 'Abuja' })).toBe('Lugbe Road, Abuja');
  });
});
