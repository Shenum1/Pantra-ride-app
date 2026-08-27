// Imported from the CJS build by an explicit relative path, not the bare
// 'expo-server/adapter/vercel' specifier or the mjs build. expo-server@1.0.7's
// ESM build ships plain .js files under build/mjs/ with no scoped
// package.json declaring "type": "module" for that folder (and the package's
// own package.json doesn't declare it either) — so Node treats those files as
// CommonJS by default and chokes on their literal `import` syntax
// ("Cannot use import statement outside a module"), regardless of whether
// they're reached via the package's exports map or a raw relative path. The
// CJS build has no such issue: it's real CommonJS, and Node/ESM interop
// exposes its named `exports.createRequestHandler` correctly.
import { createRequestHandler } from '../node_modules/expo-server/build/cjs/vendor/vercel.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default createRequestHandler({
  build: path.join(__dirname, '../dist/server'),
});
