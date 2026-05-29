import { expect, test } from '@playwright/test';

test.describe('rider booking flow', () => {
  test('allows rider to search location, select route, adjust fare and book a ride', async ({ page }) => {
    // 1. Sign In
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('email-input')).toBeVisible();

    await page.getByTestId('email-input').fill('rider@test.com');
    await page.getByTestId('password-input').fill('test123');
    await page.getByText('Sign In', { exact: true }).click();

    // 2. Main home map loaded - tap Where to?
    const searchBarTrigger = page.getByText('Where to?', { exact: true });
    await expect(searchBarTrigger).toBeVisible({ timeout: 25_000 });
    await searchBarTrigger.click();

    // 3. Search for destination
    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Eko');

    // Wait for either autocomplete or place search items
    const suggestionItem = page.locator('[data-testid^="search-autocomplete-"]')
      .or(page.locator('[data-testid^="search-place-"]'))
      .first();
    await expect(suggestionItem).toBeVisible({ timeout: 15_000 });
    await suggestionItem.click();

    // 4. Ride confirmation sheet loaded
    const bookButton = page.getByTestId('ride-map-book-button');
    await expect(bookButton).toBeVisible({ timeout: 25_000 });

    const priceCard = page.getByTestId('ride-map-price-card');
    await expect(priceCard).toBeVisible();
    const priceText = await priceCard.innerText();
    expect(priceText).toContain('₦');

    // 5. Test fare adjustment
    const fareUp = page.getByTestId('ride-map-fare-up');
    const fareDown = page.getByTestId('ride-map-fare-down');
    
    // Adjust up (+10%) and down (-10%)
    await expect(fareUp).toBeVisible();
    await fareUp.click();
    await page.waitForTimeout(500);

    await expect(fareDown).toBeVisible();
    await fareDown.click();
    await page.waitForTimeout(500);

    // 6. Complete booking
    await bookButton.click();

    // 7. Verification of progress tracker screen
    const progressSheet = page.getByTestId('ride-progress-sheet');
    await expect(progressSheet).toBeVisible({ timeout: 30_000 });
    
    // Should transition from "Finding your driver" status to "Driver accepted" or similar
    await expect(page.getByText('Finding your driver', { exact: false })
      .or(page.getByText('Driver accepted', { exact: false }))
      .or(page.getByText('Driver on the way', { exact: false }))
      .first()
    ).toBeVisible({ timeout: 20_000 });
  });
});
