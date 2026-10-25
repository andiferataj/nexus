import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootEnv = new URL(".env", root);

if (!existsSync(rootEnv)) {
  writeFileSync(
    rootEnv,
    `POSTGRES_USER=nexus\nPOSTGRES_PASSWORD=${randomBytes(24).toString("hex")}\nPOSTGRES_DB=nexus\n`,
    { flag: "wx" },
  );
}

const localVariables = {};
const previous = { ...process.env };
process.loadEnvFile(fileURLToPath(rootEnv));
for (const key of ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"])
  localVariables[key] = process.env[key];
for (const key of Object.keys(process.env))
  if (!(key in previous)) delete process.env[key];
Object.assign(process.env, previous);

if (
  !localVariables.POSTGRES_USER ||
  !localVariables.POSTGRES_PASSWORD ||
  !localVariables.POSTGRES_DB
)
  throw new Error(
    "The root .env must define POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB.",
  );
const databaseUrl = `postgresql://${encodeURIComponent(localVariables.POSTGRES_USER)}:${encodeURIComponent(localVariables.POSTGRES_PASSWORD)}@localhost:5432/${encodeURIComponent(localVariables.POSTGRES_DB)}?schema=public`;

const databaseEnv = new URL("packages/database/.env", root);
if (!existsSync(databaseEnv))
  writeFileSync(databaseEnv, `DATABASE_URL="${databaseUrl}"\n`, { flag: "wx" });

const appEnv = new URL("apps/web/.env.local", root);
if (!existsSync(appEnv))
  writeFileSync(
    appEnv,
    `DATABASE_URL="${databaseUrl}"\nAUTH_SECRET="${randomBytes(48).toString("hex")}"\nAUTH_URL="http://127.0.0.1:3000"\nAPP_URL="http://127.0.0.1:3000"\n`,
    { flag: "wx" },
  );

for (const file of [rootEnv, databaseEnv, appEnv])
  if (!readFileSync(file, "utf8").trim())
    throw new Error("An environment file is empty.");
console.log(
  "Local environment files are ready. Existing files were preserved.",
);
