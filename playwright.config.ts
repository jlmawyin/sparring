import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/*.spec.ts', timeout: 25000, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', headless: true,
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    permissions: ['microphone'], screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:web', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  reporter: [['list'], ['json', {outputFile: 'test-results/e2e.json'}]],
});
