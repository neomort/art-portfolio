import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Visual Regression Tests', () => {
  test('Homepage visual test', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    
    // Wait for the page to be fully loaded
    await expect(page.getByRole('heading', { name: /find your perfect space/i })).toBeVisible();
    
    // Take a Percy snapshot
    await percySnapshot(page, 'Homepage');
  });

  test('Properties page visual test', async ({ page }) => {
    // Navigate to the properties page
    await page.goto('/properties');
    
    // Wait for the page to be fully loaded
    await expect(page.getByRole('heading', { name: /all properties/i })).toBeVisible();
    
    // Take a Percy snapshot
    await percySnapshot(page, 'Properties Page');
  });

  test('Login page visual test', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/signin');
    
    // Wait for the page to be fully loaded
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    
    // Take a Percy snapshot
    await percySnapshot(page, 'Login Page');
  });
});
