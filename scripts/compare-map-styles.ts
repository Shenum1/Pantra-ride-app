// Before/after map style comparison for the Pantra map (docs/MAP_COVERAGE.md).
//
//   bun scripts/compare-map-styles.ts --label before
//   bun scripts/compare-map-styles.ts --label after
//
// For each audit area and zoom it downloads two Google Static Maps images at
// identical coordinates: Google's unstyled map (what Google's data contains)
// and the current Pantra style (what riders see). Comparing the two tells a
// street or landmark hidden by our styling apart from one missing in Google's
// data. Static Maps renders the same style rules as the native SDK, but the
// device is still the final check.
//
// Area coordinates are resolved once through Places Text Search and saved to
// scripts/map-audit-locations.json, so every later run uses the same points.
// Images and the side-by-side index.html go to testing/artifacts/map-styles/
// (gitignored). Bun loads EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from .env.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PANTRA_STATIC_MAP_STYLE_PARAMS } from '../constants/map-style';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCATIONS_FILE = path.join(ROOT, 'scripts', 'map-audit-locations.json');
const OUTPUT_DIR = path.join(ROOT, 'testing', 'artifacts', 'map-styles');
const ZOOMS = [13, 15, 17];
const SIZE = '400x400';

const AUDIT_AREAS = [
  { id: 'wuse-2', query: 'Wuse 2, Abuja', character: 'Dense commercial centre' },
  { id: 'garki', query: 'Garki, Abuja', character: 'Dense mixed government/commercial' },
  { id: 'gwarinpa', query: 'Gwarinpa, Abuja', character: 'Planned residential estate' },
  { id: 'kubwa', query: 'Kubwa, Abuja', character: 'Large residential satellite town' },
  { id: 'lugbe', query: 'Lugbe, Abuja', character: 'Fast-growing fringe settlement' },
  { id: 'mararaba', query: 'Mararaba, Nasarawa', character: 'Less-developed settlement, limited road data expected' },
] as const;

interface AuditLocation {
  id: string;
  query: string;
  character: string;
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
if (!apiKey) {
  console.error('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set (.env).');
  process.exit(1);
}

function readLabel(): string {
  const index = process.argv.indexOf('--label');
  const label = index !== -1 ? process.argv[index + 1] : undefined;
  if (!label || !/^[a-z0-9-]+$/.test(label)) {
    console.error('Usage: bun scripts/compare-map-styles.ts --label <before|after|...>');
    process.exit(1);
  }
  return label;
}

async function resolveLocations(): Promise<AuditLocation[]> {
  if (existsSync(LOCATIONS_FILE)) {
    return JSON.parse(readFileSync(LOCATIONS_FILE, 'utf8')) as AuditLocation[];
  }

  const resolved: AuditLocation[] = [];
  for (const area of AUDIT_AREAS) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(area.query)}&region=ng&key=${apiKey}`;
    const data = await (await fetch(url)).json() as {
      status: string;
      results?: { place_id: string; formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
    };
    const first = data.results?.[0];
    if (data.status !== 'OK' || !first) {
      throw new Error(`Could not resolve "${area.query}": ${data.status}`);
    }
    resolved.push({
      ...area,
      placeId: first.place_id,
      formattedAddress: first.formatted_address,
      latitude: Number(first.geometry.location.lat.toFixed(6)),
      longitude: Number(first.geometry.location.lng.toFixed(6)),
    });
  }

  writeFileSync(LOCATIONS_FILE, `${JSON.stringify(resolved, null, 2)}\n`);
  console.log(`Resolved ${resolved.length} audit locations -> ${path.relative(ROOT, LOCATIONS_FILE)}`);
  return resolved;
}

function staticMapUrl(location: AuditLocation, zoom: number, styled: boolean): string {
  const style = styled
    ? PANTRA_STATIC_MAP_STYLE_PARAMS.map((rule) => `&style=${encodeURIComponent(rule)}`).join('')
    : '';
  return `https://maps.googleapis.com/maps/api/staticmap?center=${location.latitude},${location.longitude}&zoom=${zoom}&size=${SIZE}&scale=2&maptype=roadmap${style}&key=${apiKey}`;
}

async function download(url: string, file: string): Promise<void> {
  const response = await fetch(url);
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !type.startsWith('image/')) {
    throw new Error(`Static map failed (${response.status} ${type}) for ${path.basename(file)}`);
  }
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

function variantDirs(): string[] {
  return readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (a === 'google-default' ? -1 : b === 'google-default' ? 1 : a.localeCompare(b)));
}

function writeIndex(locations: AuditLocation[]): void {
  const variants = variantDirs();
  const rows = locations.flatMap((location) => ZOOMS.map((zoom) => {
    const cells = variants.map((variant) => {
      const file = `${variant}/${location.id}-z${zoom}.png`;
      const exists = existsSync(path.join(OUTPUT_DIR, file));
      return `<td>${exists ? `<img src="${file}" alt="${variant} ${location.id} z${zoom}">` : '<em>not captured</em>'}</td>`;
    }).join('');
    return `<tr><th>${location.id}<br>z${zoom}<br><small>${location.character}<br>${location.latitude}, ${location.longitude}</small></th>${cells}</tr>`;
  })).join('\n');

  writeFileSync(path.join(OUTPUT_DIR, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>Pantra map style comparison</title>
<style>
  body { font: 13px system-ui, sans-serif; margin: 16px; background: #fafaf8; color: #222; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
  th { text-align: left; width: 160px; font-weight: 600; }
  img { width: 400px; height: 400px; display: block; }
</style>
<h1>Pantra map style comparison</h1>
<p>Same centre and zoom per row. google-default is unstyled Google data.</p>
<table>
<tr><th></th>${variants.map((variant) => `<th>${variant}</th>`).join('')}</tr>
${rows}
</table>
`);
}

async function main(): Promise<void> {
  const label = readLabel();
  const locations = await resolveLocations();
  const variants = [
    { dir: 'google-default', styled: false },
    { dir: `pantra-${label}`, styled: true },
  ];

  for (const variant of variants) {
    mkdirSync(path.join(OUTPUT_DIR, variant.dir), { recursive: true });
  }

  let count = 0;
  for (const location of locations) {
    for (const zoom of ZOOMS) {
      for (const variant of variants) {
        const file = path.join(OUTPUT_DIR, variant.dir, `${location.id}-z${zoom}.png`);
        if (!variant.styled && existsSync(file)) continue; // unstyled data doesn't change between runs
        await download(staticMapUrl(location, zoom, variant.styled), file);
        count += 1;
      }
    }
  }

  writeIndex(locations);
  console.log(`Downloaded ${count} images -> ${path.relative(ROOT, OUTPUT_DIR)}/index.html`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
