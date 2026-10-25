# Release instructions

## Current release gate

Source implementation and local compile/unit checks are complete for this release
candidate. Do not publish until the live database/browser checks and any enabled
provider lifecycle checks below pass. Docker is not installed on the development
machine checked in this session. No production server, domain, provider keys, or
GitHub remote have been supplied.

## Acceptance before deployment

1. Install/start Docker Desktop, confirm `docker version`, and run
   `pnpm release:check` from normal PowerShell with port 3000 free.
   The runner first checks that application and migration URLs match the local
   Compose database and that providers are disabled. Diagnose configuration alone
   with `pnpm release:preflight` (or `node scripts/release-preflight.mjs`). Use a
   separate configuration for the enabled-provider lifecycle checks below.
2. Confirm the integration suite passes against a disposable PostgreSQL database:
   account/invitation/isolation, persistent operations, REST authorization,
   password reset/session revocation, file/portal approval/revocation, and atomic
   background job claims. Fix failures before using production data.
3. Review the architecture differences in README: PostgreSQL jobs and SSE,
   private filesystem storage, and application authorization/composite constraints
   without RLS policies. Test mobile/desktop layouts in the running application.
4. Configure a GitHub remote and commit the source and `pnpm-lock.yaml`. Run the
   Verify release workflow. Its container smoke test must pass.
5. Run a dependency audit from a normal network-enabled terminal:
   `pnpm audit --prod`. Resolve or explicitly assess actual findings before release.

## Production host

Use a host with Docker Engine/Compose, persistent disk, a public domain pointed at
that host, and ports 80/443 available. Keep PostgreSQL and the web port private;
the supplied Compose file publishes only the HTTPS proxy. Provision backups and
monitoring before accepting customer data.

Create `.env.production` on the deployment host:

```powershell
pnpm setup:production your-real-domain.com
```

This writes fresh random secrets without overwriting existing files. Keep the
file private. `POSTGRES_PASSWORD` must remain URL-safe with the supplied Compose
URL; the generator produces hexadecimal values. `APP_URL` and `AUTH_URL` are
constructed from `DOMAIN` as the same HTTPS origin.

Optional email configuration requires both `RESEND_API_KEY` and `MAIL_FROM`, a
verified sender in Resend. The worker must run with the same `AUTH_SECRET` as the
web service. Verification emails and password reset messages are queued; a stopped
worker prevents delivery. The app requires verified email when email is enabled.

Optional billing configuration requires all of `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_ID` (a recurring price), and `STRIPE_WEBHOOK_SECRET`. Configure a Stripe
webhook at `https://YOUR_DOMAIN/api/stripe/webhook` for subscription created,
updated, and deleted events. Enable/configure the Stripe customer portal.
Keep test and live keys separate. Set `BILLING_REQUIRED=true` only after the
subscription lifecycle has passed acceptance. No prices or live charges have been
created by this implementation session.

Validate configuration without printing secrets, then deploy:

```powershell
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait
docker compose --env-file .env.production -f compose.production.yaml ps
```

Migrations must complete before web/worker startup. The web process refuses unsafe
production origins, placeholder auth secrets, incomplete provider groups, or paid
mode without Stripe. Caddy provisions HTTPS for the configured host. Verify
`https://YOUR_DOMAIN/api/health` returns HTTP 200 and `{ "status": "ok" }`.
The container image includes the Prisma CLI for the migration job; it is not a
minimal standalone image.

## Enabled-provider acceptance

Use provider test mode and real delivery to your own test account:

- Register, send/receive verification email, confirm once, and reject replay.
- Request and receive password reset, change the password, reject old credentials,
  reject replay/expired links, and confirm other browser sessions are revoked.
- Stop/restart the worker around a queued message; confirm delivery resumes.
  Check failed-job counts after simulated provider failure and recovery.
- Complete Stripe test Checkout, receive a verified subscription webhook, refresh
  Billing, and confirm the stored status. Duplicate delivery must not duplicate
  effects; out-of-order delivery must not revert newer subscription state.
- Test cancellation, renewal, failed payment/recovery, and customer portal return.
  With paid mode enabled, verify inactive agencies cannot add/change work through
  either forms or REST, and active/trialing agencies can. Access revocation and
  deletion must remain available while unpaid.
- Invalid webhook signatures and stale signature timestamps must be rejected.

These provider lifecycle checks have not been executed in this session.

## Backup, upgrade and operations

Back up both PostgreSQL and the uploads volume, plus protected copies of the
production configuration. Test restoring into an isolated environment. A database
backup without the matching uploads is incomplete. Do not run `down --volumes`
on a production stack.

For a database dump, write the binary dump inside the container and copy it out
rather than piping binary output through older PowerShell versions:

```powershell
docker compose --env-file .env.production -f compose.production.yaml exec database pg_dump -U nexus -d nexus -Fc -f /tmp/nexus-backup.dump
docker compose --env-file .env.production -f compose.production.yaml cp database:/tmp/nexus-backup.dump ./nexus-backup.dump
```

Before an upgrade, take/verify backups. Build the new image, explicitly run the
migration service with `run --rm migrate`, then update the stack with `up -d --wait`.
Use `NEXUS_IMAGE_TAG` to retain known release image tags for rollback. Restore a
backup if a schema rollback is needed; there is no automatic destructive rollback.
Do not edit applied migration SQL.

Monitor the public health endpoint, database capacity, private upload capacity,
web/worker errors, delivery failures and webhook delivery failures. Inspect worker
logs with `docker compose ... logs --tail=100 worker`. Logs deliberately omit
email contents and bearer tokens. Inspect EmailJob counts/ages using your secured
database administration tooling; jobs stop retrying after eight claims. After
fixing a provider issue, request a fresh verification/reset link instead of
replaying an expired token. Successful/failed jobs and old auth counters are
cleaned after seven days. Unreferenced upload files older than one day are removed
by the worker. Store no unrelated files in the upload directory.

Changing `AUTH_SECRET` revokes sessions and makes pending encrypted jobs
undecryptable. Drain the queue first or request fresh links after rotation. A
client portal link is a bearer credential: share it privately and revoke/replace
it if disclosed. Links expire after 90 days; only explicitly shared deliverables
are downloadable through them.

Keep `TRUST_PROXY=true` only behind a proxy that overwrites forwarding headers.
The supplied Caddy configuration does that and keeps the app port private. Local
signup throttling uses a shared fallback bucket when no trusted proxy is set.

## Final publication review

Create two independent agencies/accounts and confirm isolation. Walk a new client
through project creation, upload, sharing, approval and access revocation from an
incognito browser. Confirm every enabled provider works, backups restore, and the
CI release pipeline is green. Only then direct customers to the public domain.

## Dependency installation for this candidate

The scoped `deepmerge-ts` override addresses
[GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
in Prisma's configuration dependency. The updated lockfile audit is clean, but
installing the patched local copy was blocked by sandbox symlink permissions.
Before the acceptance steps above, run `pnpm install --frozen-lockfile` in normal
PowerShell, then repeat Prisma validation, unit/type checks and the production
build. Do not treat the local baseline checks as proof of the patched install.
