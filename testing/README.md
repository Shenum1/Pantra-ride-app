# Testing Suite

This folder contains the project test files for the Expo ride app.

## Folder layout

- `unit/` - focused tests for individual services and utility behavior.
- `integration/` - tests that check how internal modules work together, such as the tRPC router.
- `e2e/` - browser tests that run the app like a user would, using Playwright.

## Commands

Run all unit and integration tests:

```bash
npm test
```

Run only unit tests:

```bash
npm run test:unit
```

Run only integration tests:

```bash
npm run test:integration
```

Run the end-to-end browser traversal:

```bash
npm run test:e2e
```

Run the full suite:

```bash
npm run test:all
```

Generate a coverage report:

```bash
npm run test:coverage
```

The E2E suite starts Expo web on `http://127.0.0.1:8081` automatically when needed.
