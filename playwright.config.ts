import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH },
  },
  webServer: {
    command:
      "NEXT_DIST_DIR=.next-e2e npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
    // Browser tests exercise anonymous UI and mock auth POSTs; never use live credentials.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only-anonymous-key",
      APP_BASE_URL: "http://127.0.0.1:3100",
    },
  },
});
