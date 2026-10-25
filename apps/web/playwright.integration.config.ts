import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const localEnv = fileURLToPath(new URL(".env.local", import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export default defineConfig(base, {
  testDir: "./test/integration",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
});
