import { expect, test } from '@playwright/test';

test.describe('rider auth flow', () => {
  test('allows the documented test rider to sign in and reach rider home', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('email-input')).toBeVisible();

    await page.getByTestId('email-input').fill('rider@test.com');
    await page.getByTestId('password-input').fill('test123');
    await page.getByText('Sign In', { exact: true }).click();

    await expect(page.getByText('Where to?', { exact: true })).toBeVisible({ timeout: 30_000 });
  });

  test('shows signup with optional profile photo copy', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Add Photo (Optional)', { exact: true })).toBeVisible();
    await expect(page.getByText('Profile photo is required')).toHaveCount(0);
  });
});
