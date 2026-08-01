import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data", "e2e");
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

/** Playwright webServer.env requires defined strings (ProcessEnv allows undefined). */
function definedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * End-to-end suite for the EdgeTX Dashboard Generator web app.
 * Not wired into CI yet — run locally with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
    colorScheme: "dark",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /.*\.ai\.spec\.ts/,
    },
    {
      name: "ai",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /.*\.ai\.spec\.ts/,
      timeout: 300_000,
    },
  ],
  webServer: {
    command: `npx next dev -p ${port}`,
    cwd: path.join(rootDir, "apps", "web"),
    url: `${baseURL}/api/health`,
    // Never reuse a developer server by default — it lacks WIDGET_GEN_DATA_DIR
    // isolation and may hold real AI keys. Opt in with E2E_REUSE_SERVER=1.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 180_000,
    env: {
      ...definedEnv(process.env),
      WIDGET_GEN_DATA_DIR: dataDir,
      // Keep AI server keys out of the default smoke suite so ready:false paths are exercised.
      // AI project tests inject browser keys (or rely on E2E_ALLOW_SERVER_AI=1).
      ...(process.env.E2E_ALLOW_SERVER_AI === "1"
        ? {}
        : {
            CURSOR_API_KEY: "",
            ANTHROPIC_API_KEY: "",
            OPENAI_API_KEY: "",
            GEMINI_API_KEY: "",
          }),
      GENERATOR_API_SECRET: "",
    },
  },
});
