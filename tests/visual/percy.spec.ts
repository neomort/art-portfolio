import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test('Homepage visual test', async ({ page }) => {
  await page.goto('/');
  // Take a screenshot for debugging
  await page.screenshot({ path: 'homepage-debug.png', fullPage: true });

  // Print out the page content for debugging
  const content = await page.content();
  console.log('PAGE CONTENT:', content);

  // Try a less specific check
  const h1 = await page.locator('h1').first();
  await expect(h1).toBeVisible();

  // Take a Percy snapshot
  await percySnapshot(page, 'Homepage');
});

