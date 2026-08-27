// Imported by an explicit relative path, not the bare 'expo-server/adapter/vercel'
// specifier — this repo has two different expo-server versions installed (the
// top-level one used by expo-router, and an unrelated newer one nested inside
// @expo/cli for its own dev-server use). Vercel's function bundler was tracing
// the bare specifier to the wrong nested copy, which doesn't export
// createRequestHandler. A relative path pins exactly which file gets bundled.
import { createRequestHandler } from '../node_modules/expo-server/build/mjs/vendor/vercel.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default createRequestHandler({
  build: path.join(__dirname, '../dist/server'),
});
