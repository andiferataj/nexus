import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
function run(command, args) {
  // Commands and arguments are fixed below; no user input is passed to a shell.
  const result = spawnSync(command, args, {
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
    env: { ...process.env, NEXUS_TEST_PRODUCTION: "1" },
  });
  if (result.error || result.status !== 0) {
    console.error(
      `Release verification stopped at ${command} ${args.join(" ")}.`,
    );
    process.exit(result.status || 1);
  }
}
run("pnpm", ["setup:env"]);
run("node", ["scripts/release-preflight.mjs"]);
run("docker", ["version"]);
run("docker", ["compose", "up", "-d", "--wait"]);
for (const args of [
  ["db:generate"],
  ["db:validate"],
  ["db:deploy"],
  ["format:check"],
  ["typecheck", "--env-mode=loose"],
  ["test"],
  ["build", "--env-mode=loose"],
  ["--filter", "@nexus/web", "exec", "playwright", "install", "chromium"],
  ["test:e2e"],
  ["test:integration"],
])
  run("pnpm", args);
console.log(
  "Local production build and browser acceptance checks passed. Complete the provider and deployment checks in docs/release.md before publishing.",
);
