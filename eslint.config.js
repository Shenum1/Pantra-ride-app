const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'dist/*',
      'web-build/*',
      '.expo/*',
      'coverage/*',
      'test-results/*',
      'playwright-report/*',
      'ios/*',
      'android/*',
      'admin-web/*',
    ],
  },
  {
    // scripts/ contains plain Node.js CLI scripts (run via `node scripts/x.mjs`),
    // not app code — they need Node globals (Buffer, process, etc.) that the
    // rest of this config intentionally doesn't provide for app/lib/component code.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
];
