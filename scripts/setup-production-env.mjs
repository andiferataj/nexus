import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const domain = process.argv[2]?.trim().toLowerCase();
if (
  !domain ||
  !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    domain,
  ) ||
  domain.endsWith(".example")
) {
  console.error("Usage: pnpm setup:production your-real-domain.com");
  process.exit(1);
}
try {
  writeFileSync(
    ".env.production",
    `DOMAIN=${domain}\nPOSTGRES_PASSWORD=${randomBytes(32).toString("hex")}\nAUTH_SECRET=${randomBytes(48).toString("hex")}\n\n# Optional email provider; set both to enable password reset emails.\nRESEND_API_KEY=\nMAIL_FROM=\n\n# Optional Stripe subscription; set all three to enable billing.\nSTRIPE_SECRET_KEY=\nSTRIPE_PRICE_ID=\nSTRIPE_WEBHOOK_SECRET=\nBILLING_REQUIRED=false\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env.production with fresh secrets. Existing files are never overwritten.",
  );
} catch (error) {
  console.error(
    error?.code === "EEXIST"
      ? ".env.production already exists. Edit it directly; secrets were not changed."
      : "Could not create the production environment file.",
  );
  process.exit(1);
}
