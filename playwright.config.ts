import { defineConfig, devices } from '@playwright/test';

// Base Playwright configuration
export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000, // 30 seconds
  expect: {
    timeout: 5000 // 5 seconds
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5173', // Default to Vite dev server
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Auto-start Vite preview server for visual tests
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
