import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateProductionEnvironment } from "./validate-environment.mjs";

const failures = validateProductionEnvironment(process.env);
if (failures.length) {
  console.error(
    `Nexus configuration is incomplete:\n${failures.map((value) => `- ${value}`).join("\n")}`,
  );
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    process.env.PORT ?? "3000",
  ],
  {
    cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
    stdio: "inherit",
    env: process.env,
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Nexus could not start.");
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
