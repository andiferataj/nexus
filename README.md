# Nexus

Agency operations SaaS built with Next.js, React, Auth.js, PostgreSQL, Prisma,
TypeScript, pnpm, and Turborepo.

## What is implemented

- Accounts, password hashing, sign-in and signup limits, password recovery, email
  verification, and session revocation after password reset.
- Multiple agencies per account, workspace switching, owner/admin/member roles,
  invitations, current-membership authorization, and last-owner protection.
- Persistent clients, client contacts, projects, budgets, tasks, assignments,
  comments, search/filtering, and a task Kanban board.
- Private project uploads/downloads, explicitly shared deliverables, client
  approval/change requests, and expiring/revocable client portal links.
- Personal notifications, live notification updates, activity history, project
  progress and workload analytics.
- Optional Stripe Checkout, billing portal, verified/idempotent subscription
  webhooks, and optional subscription requirements for work creation/changes.
- Encrypted email jobs, delivery retries, retention cleanup, private file cleanup,
  deployment containers, HTTPS proxy, health checks, and a CI release pipeline.

The public home page is `/`. The sample dashboard is `/demo`; its data resets on
refresh. Real persistent agencies live under `/workspaces`.

**Publication is still gated on live PostgreSQL/browser acceptance and configured
provider checks.** See [verification status](docs/implementation-status.md) and
[release instructions](docs/release.md). A successful compile is not a completed
production acceptance run.

## Run locally

Install Node.js 24, pnpm 10.33.0, and Docker Desktop with Linux containers and
Compose. From the repository root:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm setup:env
docker compose up -d --wait
pnpm db:generate
pnpm db:validate
pnpm db:deploy
pnpm build --env-mode=loose
pnpm dev:web
```

Open `http://127.0.0.1:3000`. Use that hostname consistently for the browser,
`AUTH_URL`, and `APP_URL`. Environment setup creates local credentials/secrets and
preserves existing files. The build uses Webpack for consistent Windows builds.

In a second terminal, run the background worker after building the packages:

```powershell
pnpm worker
```

For email delivery, add both `RESEND_API_KEY` and a verified `MAIL_FROM` sender to
`apps/web/.env.local`, then restart the app and worker. Email verification becomes
required for workspace access when email is configured. Without email provider
configuration, the local app allows accounts without verification and explains
that password reset email is unavailable. Never use real provider keys in tests.

## Verify a release

With dependencies installed and Docker Desktop running, stop any server on port
3000 and run:

```powershell
pnpm release:check
```

This starts the local database, applies migrations, checks formatting/types/unit
tests, builds production output, installs Chromium, and runs browser suites against
the production server. It stops on the first failure and uses the local development
database; integration tests create disposable accounts/agencies.

Individual checks:

```powershell
pnpm release:preflight
pnpm format:check
pnpm typecheck --env-mode=loose
pnpm test
pnpm db:validate
pnpm build --env-mode=loose
pnpm test:e2e
pnpm test:integration
```

Release preflight checks that the app and migrations target the same local Compose
database before migrations run. It also checks local origins and requires email
and billing providers disabled for this suite. Run provider lifecycle acceptance
separately as described in the release guide. It never prints credentials.

CI runs migration deployment, both browser suites, and a container build/start
check on Linux with PostgreSQL. It is configured in `.github/workflows/ci.yaml`;
it has not run on a remote repository from this environment.

## Publish

Follow [docs/release.md](docs/release.md). Generate deployment secrets with:

```powershell
pnpm setup:production your-real-domain.com
```

The production Compose stack includes PostgreSQL, migration runner, web app,
background worker, persistent uploads, and Caddy for HTTPS. A host and domain are
required. No production credentials, DNS changes, or deployment have been made.

## Architecture and limits

Tenant authorization lives in the services and applies to forms, downloads, and
REST resources. PostgreSQL composite foreign keys also prevent cross-agency
client/project/task/file relations. This release does not install PostgreSQL RLS
policies; use the application service boundary for database access.

The earlier architecture proposed Redis/BullMQ and WebSockets. The implemented
release uses a PostgreSQL outbox with atomic leased jobs and server-sent events
with ten-second notification checks. Redis/BullMQ/WebSocket infrastructure is not
included. Email jobs use the same application secret on the web app and worker;
queued contents are encrypted and cleared after delivery.

Uploads use a private filesystem volume on one host. Multiple web replicas require
a shared filesystem or an object-storage adapter. The analytics report budgets,
completion, deadlines, and workload; budgets are not recognized revenue or profit.
Stripe pricing is configured in Stripe. Billing is optional by default; setting
`BILLING_REQUIRED=true` requires an active/trialing subscription for adding or
changing work. Reading, deletion, access revocation, and billing remain available.

The REST interface is documented in [docs/api.md](docs/api.md). Historical sprint
notes describe earlier checkpoints; current status and release docs supersede
their old verification results.

| Path                 | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `apps/web`           | Landing/demo, authenticated application, client portal, REST, browser tests |
| `packages/contracts` | Runtime input validation and domain errors                                  |
| `packages/core`      | Tenant services, operations, collaboration, encrypted mail payloads         |
| `packages/auth`      | Passwords, account registration/authentication and recovery/verification    |
| `packages/database`  | Prisma schema, migrations, PostgreSQL repository                            |
| `packages/shared`    | Shared organization types and slug utilities                                |
| `scripts`            | Environment setup, release checks, background delivery/cleanup              |
| `deploy`             | HTTPS proxy configuration                                                   |
| `docs`               | Release, API and verification documentation                                 |
