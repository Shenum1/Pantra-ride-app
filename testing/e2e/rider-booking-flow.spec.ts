import { expect, test } from '@playwright/test';

async function signInAsTestRider(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('email-input')).toBeVisible();

  await page.getByTestId('email-input').fill('rider@test.com');
  await page.getByTestId('password-input').fill('test123');
  await page.getByText('Sign In', { exact: true }).click();

  await expect(page.getByText('Where to?', { exact: true })).toBeVisible({ timeout: 30_000 });
}

test.describe('rider booking traversal', () => {
  test('searches a live destination, confirms fare controls, and books a test ride', async ({ page }) => {
    await signInAsTestRider(page);

    await page.getByText('Where to?', { exact: true }).click();
    await expect(page.getByTestId('search-input')).toBeVisible();
    await page.getByTestId('search-input').fill('Jabi');
    await expect(page.getByText('Jabi', { exact: false })).toBeVisible({ timeout: 45_000 });
    await page.getByText('Jabi', { exact: false }).first().click();

    await expect(page.getByTestId('ride-map-sheet')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ride-destination-card')).toContainText('Jabi', { timeout: 30_000 });

    await page.getByTestId('ride-sheet-handle').click();
    await expect(page.getByTestId('ride-map-fare-card')).toBeVisible();

    await page.getByTestId('ride-map-adjustment-10').click();
    await expect(page.getByTestId('ride-map-price-card')).toBeVisible();

    await expect(page.getByTestId('ride-map-book-button')).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId('ride-map-book-button').click();

    await expect(page.getByTestId('ride-progress-sheet')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Looking for a nearby driver', { exact: false })).toBeVisible();
  });
});
