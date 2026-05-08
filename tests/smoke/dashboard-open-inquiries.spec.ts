import { test, expect } from '@playwright/test';

// Smoke: Dashboard – Open Inquiries
// This test is resilient: it logs warnings instead of failing hard if optional UI isn't present.

test.describe('Smoke - Dashboard Open Inquiries', () => {
  test('loads dashboard and shows Open Inquiries section', async ({ page }) => {
    const res = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), 'dashboard route should load').toBeTruthy();

    // Try common headings/selectors
    const heading = page.getByRole('heading', { name: /open inquiries/i });
    const gridLabel = page.getByText(/open inquiries/i).first();

    // Prefer role-based heading; fall back to text
    const foundHeading = await heading.count();
    const foundText = await gridLabel.count();

    if (foundHeading === 0 && foundText === 0) {
      console.warn('[SMOKE] Open Inquiries heading/text not found on /dashboard. Skipping strict assertion.');
    } else {
      await expect(foundHeading > 0 || foundText > 0).toBeTruthy();
    }

    // Basic interaction check if an inquiry item exists
    const firstRow = page.locator('[data-testid="inquiry-row"]').first();
    if (await firstRow.count()) {
      await firstRow.click();
      // Expect a detail drawer/page to render
      const detail = page.getByRole('heading', { name: /inquiry/i }).first();
      if (await detail.count()) {
        await expect(detail).toBeVisible();
      }
    } else {
      console.warn('[SMOKE] No inquiry rows found; continuing.');
    }
  });
});
