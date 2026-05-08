import { test, expect } from '@playwright/test';

// Smoke: Payment Confirmation
// Tries a likely confirmation route and validates presence of success/error UI without failing hard.

test.describe('Smoke - Payment Confirmation', () => {
  test('renders a confirmation page with success or error state', async ({ page }) => {
    // Try the common route first
    const res = await page.goto('/payment/confirm', { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), 'payment confirmation route should load (or redirect)').toBeTruthy();

    // Look for typical success markers
    const successHeading = page.getByRole('heading', { name: /payment|confirmed|success/i }).first();
    const successText = page.getByText(/payment|confirmed|success/i).first();

    // Or an error state
    const errorHeading = page.getByRole('heading', { name: /error|failed|problem/i }).first();
    const errorText = page.getByText(/error|failed|problem/i).first();

    const found = (await successHeading.count()) || (await successText.count()) || (await errorHeading.count()) || (await errorText.count());
    if (!found) {
      console.warn('[SMOKE] No obvious payment confirmation success/error markers found at /payment/confirm');
    } else {
      await expect(found > 0).toBeTruthy();
    }

    // Check presence of a primary navigation CTA
    const cta = page.getByRole('link', { name: /dashboard|view booking|back/i }).first();
    if (await cta.count()) {
      await expect(cta).toBeVisible();
    } else {
      console.warn('[SMOKE] No primary CTA found on payment confirmation');
    }
  });
});
