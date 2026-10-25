# Sprint 1.4: Account and database integration

Source is implemented; framework/database integration verification is pending.

| Path                                               | Responsibility                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`           | Users, agencies, memberships, invitations, Auth.js-compatible records, and sign-in counters. |
| `packages/database/prisma/migrations`              | Initial PostgreSQL tables, enums, indexes, and foreign keys.                                 |
| `packages/database/src/index.ts`                   | Prisma repository, serializable transactions, and conflict retries.                          |
| `apps/web/src/auth.ts`                             | Auth.js credentials provider and eight-hour JWT sessions containing the user ID.             |
| `apps/web/src/types/next-auth.d.ts`                | Typed session user ID.                                                                       |
| `apps/web/src/app/api/auth/[...nextauth]/route.ts` | Auth.js handlers in Node.                                                                    |
| `apps/web/src/lib/server.ts`                       | Server-only service initialization and session requirement.                                  |
| `apps/web/src/app/actions.ts`                      | Authenticated mutations, validated redirects, invitation links, and sign-out.                |
| `apps/web/src/app/sign-in` and `sign-up`           | Account forms and session-aware redirects.                                                   |
| `apps/web/src/app/workspaces`                      | Agency selection/creation, authorized team display, invitations, and switching.              |
| `apps/web/src/app/invite`                          | Explicit authenticated POST invitation acceptance.                                           |
| `apps/web/src/components/action-form.tsx`          | React action state, pending status, and errors.                                              |
| `compose.yaml`                                     | Local PostgreSQL 17, health check, and loopback-only port binding.                           |
| `scripts/setup-env.mjs`                            | Generates ignored local credentials/secrets; preserves existing files.                       |
| `apps/web/test/integration/accounts.spec.ts`       | Real registration, agency, tenant, invitation, switching, and sign-out test.                 |

The credentials flow uses JWT sessions. Tenant roles are read from current
membership on every protected operation, rather than embedded in the token.
Account, Session, and VerificationToken tables prepare the schema for future
adapter-based Auth.js providers; no OAuth provider is enabled. Unauthorized agency
pages use the same 404 response as nonexistent agencies. GET requests never accept
invitations. Safe return paths reject external URLs and unrecognized routes.

Follow the README setup. Local environment files were generated in this session.
Use `http://127.0.0.1:3000` consistently for the app, Auth.js, invitations, and tests.
Dependencies and the lockfile are now resolved by the local installation.
Auth.js follows its documented beta channel. Prisma uses 6.x, matching the
datasource URL and client generator in this schema.

Prisma client generation, schema validation, full workspace typechecking, and
all 32 unit tests now pass with the installed dependencies. The initial migration
was compared with Prisma's generated SQL. Its missing public-schema creation
statement was added; all 32 SQL statements now match after comment/whitespace
normalization. The migration has not been applied to a live database yet.

The default Turbopack build encounters a Windows junction restriction in this
sandbox. A supported Webpack build compiles and passes Next.js's TypeScript
phase, then encounters a sandbox mkdir permission error during static page output.
The complete production build still needs verification from normal PowerShell.
Prisma's installed engine paths were supplied through its supported environment
variables for local verification; no machine-specific paths were saved in source.

Next checks: install/start Docker Desktop, start PostgreSQL, apply the migration,
run the production build from normal PowerShell, and run both real browser suites.
Fix integration defects before persisted projects, billing, workers, or deployment.
The root demo's projects are not database-backed records.
