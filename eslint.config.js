const expoConfig = require('eslint-config-expo/flat');

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
];
