# Nexus implementation status - 2026-10-24

## Current result

The local production build and automated application acceptance checks pass.
This supersedes the earlier notes about missing PostgreSQL and blocked browser
access. No public deployment has been performed, and provider lifecycle and
hosting acceptance remain separate release gates.

## Latest verification

| Check                                            | Result                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Next.js Webpack production build                 | Passed, including TypeScript, route generation and tracing |
| Unit, domain, service and utility tests          | 54 passed                                                  |
| PostgreSQL-backed integration tests              | 6 passed in 26.4 seconds                                   |
| Production dashboard browser tests               | 6 passed in 4.7 seconds, including mobile navigation       |
| Repository formatting                            | Passed                                                     |
| Local release configuration                      | Passed                                                     |
| Email and Stripe provider lifecycle              | Not executed against configured providers                  |
| Container build, hosted HTTPS and backup restore | Not verified in this session                               |
| Git publication                                  | No commit or push performed in this session                |

The browser suites ran in Chromium against a locally started production server
and the configured local PostgreSQL database. These are executed tests, not test
discovery. Direct installed CLI entrypoints were used because this terminal's
Corepack process still attempts an unavailable pnpm download. This is not a claim
that the entire pnpm release runner or hosted CI ran in this session.

## Fixes from integration acceptance

- Dropdown selectors now use the combobox role and exact accessible names rather
  than exact label text that also includes option text.
- Agency-name selectors use exact matching to avoid matching the URL field hint.
- Form-error assertions are scoped to forms, excluding Next.js route announcements.
- The rejected-password assertion accepts straight and curly apostrophes.
- JWT validation reads only the current account session version with one direct
  database query, avoiding an unnecessary interactive transaction. Deleted users
  and mismatched session versions still revoke sessions. Account and password
  recovery integration tests pass with this change.

The original Next.js sidebar navigation remains in place. A normal-anchor
experiment did not resolve the observed transaction timeout and was reverted.

Repeated local test runs exhausted the shared local signup limit. After checking
that the environment targeted the local Compose database, only the signup:local
counter was reset for acceptance. Production limits were not raised or bypassed.
Use an isolated acceptance database; test accounts and agencies are disposable.

## Implemented application

- Accounts, password hashing, signup/sign-in limits, email verification, password
  reset and session revocation.
- Agencies, workspace switching, owner/admin/member permissions, invitations,
  current-membership authorization and last-owner protection.
- Database-backed clients, contacts, projects, budgets, deadlines, tasks,
  assignments, comments, search and Kanban.
- Private uploads/downloads, explicit sharing, client approvals and change
  requests, expiring/revocable portal links.
- Activity history, notifications, live notification refresh and workload metrics.
- Optional Stripe checkout/portal and subscription webhooks; optional paid writes.
- Encrypted email jobs with retries, leased claims and cleanup.
- Migrations, environment setup, health checks, Docker/Compose/Caddy source and CI.

Integration acceptance covers accounts/invitations/isolation, REST authorization,
concurrent email-job claims, uploads/portal approval/revocation, password recovery
and session revocation, and client/project/task persistence and deletion.

## Remaining publication work

1. Run configured email delivery and Stripe test-mode lifecycle checks if those
   optional features will be enabled. Automated local acceptance leaves providers
   disabled; it does not validate real delivery, checkout or webhook delivery.
2. Verify the Docker image and deployment stack on the chosen host, including
   HTTPS, migrations, worker startup and persistent uploads.
3. Configure and test database/upload backups and restoration.
4. Commit the source, configure the intended remote and run CI before release.
5. Verify the deployed health endpoint and customer flows on the public origin.

No production host, domain or provider credentials were supplied for deployment.
See [release.md](release.md) for commands and provider acceptance steps.

## Architecture and limits

The release uses PostgreSQL email jobs and server-sent events, rather than the
previously proposed Redis/BullMQ and WebSockets. Tenant isolation is enforced by
service authorization and composite foreign keys, without PostgreSQL RLS. Files
use a private filesystem volume on one host; multiple replicas require shared
storage or an object-storage adapter. Analytics track operational budgets and
progress rather than recognized accounting revenue or profit.
