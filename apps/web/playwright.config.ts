import { defineConfig, devices } from "@playwright/test";

const externalUrl = process.env.NEXUS_TEST_BASE_URL;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: externalUrl ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(externalUrl
    ? {}
    : {
        webServer: {
          command:
            process.env.NEXUS_TEST_PRODUCTION === "1"
              ? "pnpm start --hostname 127.0.0.1"
              : "pnpm dev --hostname 127.0.0.1",
          url: "http://127.0.0.1:3000",
          reuseExistingServer:
            !process.env.CI && process.env.NEXUS_TEST_PRODUCTION !== "1",
        },
      }),
});
