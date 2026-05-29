import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const envFiles = ['.env', 'env'];

function loadLocalEnv() {
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

async function checkJsonApi(label, url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    const ok = response.ok && (data.status === 'OK' || data.status === 'ZERO_RESULTS');
    return {
      label,
      ok,
      httpStatus: response.status,
      googleStatus: data.status ?? 'UNKNOWN',
      message: data.error_message ?? '',
    };
  } catch (error) {
    return {
      label,
      ok: false,
      httpStatus: 'NETWORK_ERROR',
      googleStatus: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkStaticMap(key) {
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?center=9.0765,7.3986&zoom=14&size=300x200&key=${key}`);
    const contentType = response.headers.get('content-type') ?? '';
    return {
      label: 'Static Maps',
      ok: response.ok && contentType.toLowerCase().startsWith('image/'),
      httpStatus: response.status,
      googleStatus: response.ok ? 'IMAGE_RESPONSE' : 'REJECTED',
      message: contentType,
    };
  } catch (error) {
    return {
      label: 'Static Maps',
      ok: false,
      httpStatus: 'NETWORK_ERROR',
      googleStatus: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

loadLocalEnv();

const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!key) {
  console.error('Google Maps API key is missing. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env.');
  process.exit(1);
}

const checks = await Promise.all([
  checkJsonApi('Places Text Search', `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent('Shoprite Abuja Nigeria')}&key=${key}`),
  checkJsonApi('Places Autocomplete', `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent('Kubwa')}&components=country:ng&key=${key}`),
  checkJsonApi('Directions', `https://maps.googleapis.com/maps/api/directions/json?origin=9.0820,7.4951&destination=9.0579,7.4951&key=${key}`),
  checkStaticMap(key),
]);

for (const check of checks) {
  const status = check.ok ? 'PASS' : 'FAIL';
  console.log(`${status} ${check.label}: HTTP ${check.httpStatus}, Google ${check.googleStatus}${check.message ? `, ${check.message}` : ''}`);
}

if (checks.some((check) => !check.ok)) {
  console.log('\nResolution: enable the failing Google Maps APIs, confirm billing is active, and allow this app origin in the key restrictions.');
  process.exit(1);
}

console.log('\nGoogle Maps key is valid for the required app APIs.');
