import { expect, test } from '@playwright/test';

test.describe('driver dashboard flow', () => {
  test('allows driver to select role, log in, view dashboard and toggle online status', async ({ page }) => {
    // 1. Bypass splash intro screen and go directly to Role Selection
    await page.goto('/role-selection', { waitUntil: 'domcontentloaded' });
    
    // 2. Select Driver Role
    const driverRoleBtn = page.getByTestId('driver-role-button');
    await expect(driverRoleBtn).toBeVisible({ timeout: 15_000 });
    await driverRoleBtn.click();

    // 3. Login
    await expect(page.getByTestId('driver-email-input')).toBeVisible();
    await page.getByTestId('driver-email-input').fill('driver@test.com');
    await page.getByTestId('driver-password-input').fill('test123');
    await page.getByText('Sign In', { exact: true }).click();

    // 4. Verify Dashboard metrics and active/inactive state
    await expect(page.getByText("Today's Earnings", { exact: false })).toBeVisible({ timeout: 25_000 });
    
    // 5. Toggle Online / Offline status
    const statusText = page.getByText('Offline').or(page.getByText('Online'));
    await expect(statusText).toBeVisible();
    const isInitiallyOffline = await page.getByText('Offline').isVisible();

    // Click the toggle
    await statusText.click();
    await page.waitForTimeout(1000);

    // Verify it changed state
    if (isInitiallyOffline) {
      await expect(page.getByText('Online')).toBeVisible();
    } else {
      await expect(page.getByText('Offline')).toBeVisible();
    }
  });
});
