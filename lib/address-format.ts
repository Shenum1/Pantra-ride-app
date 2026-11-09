// Turns a device reverse-geocode result (expo-location reverseGeocodeAsync)
// into the short address shown as the rider's pickup, e.g.
// "Ahmadu Bello Way, Wuse 2, Abuja". Returns null when the result has nothing
// more specific than a city, so the caller can show "Current location"
// rather than an address that tells the driver nothing.

export interface ReverseGeocodeParts {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
}

// Android's geocoder often returns an Open Location Code ("8J2F+XQ") as the
// feature name when there is no named place.
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}\b/i;

function clean(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return PLUS_CODE.test(trimmed) ? '' : trimmed;
}

export function formatReverseGeocodedAddress(parts: ReverseGeocodeParts): string | null {
  const street = clean(parts.street);
  const streetNumber = clean(parts.streetNumber);
  const name = clean(parts.name);

  const streetLine = street ? (streetNumber ? `${streetNumber} ${street}` : street) : '';
  // `name` is often just the house number or the street again; keep it only
  // when it names something else (an estate, a building).
  const placeName = name && name !== streetNumber && !streetLine.toLowerCase().includes(name.toLowerCase()) ? name : '';
  const area = clean(parts.district);
  const city = clean(parts.city) || clean(parts.subregion);

  const specific = [placeName, streetLine, area].filter(Boolean);
  if (specific.length === 0) return null;

  const seen = new Set<string>();
  return [...specific, city]
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}
