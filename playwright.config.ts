import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const dashboardUrl = "http://localhost:3215";
const websiteUrl = "http://localhost:3216";
const dashboardRoot = process.cwd();
const websiteRoot = resolve(dashboardRoot, "../sogatra-web");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3215",
      cwd: dashboardRoot,
      url: `${dashboardUrl}/sign-in`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        PLAYWRIGHT_NEXT_DIST_DIR: ".next-playwright",
      },
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3216",
      cwd: websiteRoot,
      url: `${websiteUrl}/id/plan-your-visit`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3217",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "playwright-local-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "",
        PLAYWRIGHT_NEXT_DIST_DIR: ".next-playwright",
        NEXT_PUBLIC_SANITY_PROJECT_ID: "",
      },
    },
    {
      command: "node tests/e2e/public-price-stub.mjs",
      cwd: dashboardRoot,
      url: "http://127.0.0.1:3217/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
