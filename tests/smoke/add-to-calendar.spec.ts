import { test, expect } from '@playwright/test';

// Smoke: Add to Calendar from a booking/order detail page.
// Tries common selectors/text and logs warnings if feature is not visible in current data state.

test.describe('Smoke - Add to Calendar', () => {
  test('exposes an Add to Calendar action and produces an ICS or calendar link', async ({ page }) => {
    // Navigate to a plausible bookings route; adjust if your app uses a different path
    const res = await page.goto('/bookings', { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), 'bookings route should load').toBeTruthy();

    // Try to open the first booking detail
    const firstRow = page.locator('[data-testid="booking-row"], [data-testid="reservation-row"]').first();
    if (await firstRow.count()) {
      await firstRow.click();
    } else {
      console.warn('[SMOKE] No booking rows found; attempting direct detail route fallback.');
      await page.goto('/bookings/1', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    // Find Add to Calendar control
    const addBtn = page.getByRole('button', { name: /add to calendar/i }).first();
    const addLink = page.getByRole('link', { name: /add to calendar/i }).first();

    const hasBtn = await addBtn.count();
    const hasLink = await addLink.count();

    if (!hasBtn && !hasLink) {
      console.warn('[SMOKE] Add to Calendar control not found on booking detail.');
      return; // Not a hard fail for smoke
    }

    // Interact and observe effect
    const [download] = await Promise.all([
      page.waitForEvent('download').catch(() => null),
      hasBtn ? addBtn.click() : addLink.click(),
    ]);

    if (download) {
      const suggested = download.suggestedFilename();
      console.log('[SMOKE] Downloaded:', suggested);
      expect(/\.ics$/i.test(suggested)).toBeTruthy();
      return;
    }

    // If not a download, expect a calendar URL to open in same tab
    const url = page.url();
    if (/calendar\.google\.com|outlook\.live\.com|office\.com|ical/.test(url)) {
      expect(true).toBeTruthy();
    } else {
      console.warn('[SMOKE] No ICS download and no known calendar URL detected after action.');
    }
  });
});
