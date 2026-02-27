import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for Chrome Extension testing
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Run tests serially for better debugging
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Launch options for extension testing
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname)}`,
            `--load-extension=${path.resolve(__dirname)}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
          headless: false, // Extensions don't work well in headless mode
        },
        contextOptions: {
          // Viewport size
          viewport: { width: 1280, height: 720 },
        },
      },
    },
  ],

  // Folder for test artifacts such as screenshots, videos, traces, etc.
  outputDir: 'test-results/',
});
