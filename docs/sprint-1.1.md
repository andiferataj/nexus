# Sprint 1.1 — Workspace foundation

## What this checkpoint does

This checkpoint makes the monorepo buildable before adding the Next.js app.
It defines an organization as an agency and a membership as the connection
between a user and an agency. A user can eventually belong to multiple agencies
and have a different role in each one.

The shared types describe domain objects inside the application. They are not
runtime validation, database models, or permission checks. For example, dates
are `Date` objects here; an HTTP contract will need to handle their serialization.

## Files and concepts

| File                                         | What to learn                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                               | Root commands delegate to Turbo; `packageManager` pins pnpm 10.33.0.                                                                   |
| `pnpm-workspace.yaml`                        | Globs identify applications, shared packages, and tooling as one workspace.                                                            |
| `pnpm-lock.yaml`                             | Records external versions and links between local workspace packages. Commit this file.                                                |
| `turbo.json`                                 | Describes task dependencies, cached outputs, and persistent development tasks; compiler configuration changes invalidate cached tasks. |
| `.gitignore`                                 | Keeps dependencies, generated output, caches, and local secrets out of Git.                                                            |
| `.gitattributes`                             | Keeps source line endings consistent across Windows and Linux.                                                                         |
| `tooling/typescript/package.json`            | Gives the shared compiler configuration a workspace package name.                                                                      |
| `tooling/typescript/base.json`               | Defines strict settings reused by TypeScript packages.                                                                                 |
| `packages/shared/package.json`               | Exposes built JavaScript and type declarations through `@nexus/shared`.                                                                |
| `packages/shared/tsconfig.json`              | Extends the shared settings and compiles `src` into `dist`.                                                                            |
| `packages/shared/src/organization.ts`        | Defines agency data, per-agency roles, and slug normalization.                                                                         |
| `packages/shared/src/index.ts`               | Defines the package's public exports.                                                                                                  |
| `packages/shared/test/organization.test.mjs` | Exercises the public compiled package using Node's test runner.                                                                        |

`workspace:*` links a dependency to a local workspace package rather than an
unrelated package from the registry. TypeScript and Turbo are development tools
installed at the workspace root; pnpm makes the root tools available to package scripts.

`NodeNext` follows Node's module rules. With `type: module`, the shared package
emits ES modules. Source imports use `.js` extensions because those imports
must resolve in the compiled JavaScript as well.

`strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` help catch
missing values before runtime. Declaration files let future apps see the shared
types; source and declaration maps help editors navigate back to the source.

## Slug behavior

```typescript
import { createOrganizationSlug } from "@nexus/shared";

createOrganizationSlug("My Agency"); // "my-agency"
createOrganizationSlug("Élan & Co. — Studio 42!"); // "elan-co-studio-42"
```

The helper creates an ASCII URL candidate. Accents are normalized, punctuation
becomes a hyphen, and edge hyphens are removed. Some names produce an empty
candidate; different names can produce the same candidate. The future agency
creation flow must reject an empty slug and enforce uniqueness in the database.
A slug is a URL identifier, never proof that the current user can access an agency.

## Verification

Run from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm clean
pnpm build
pnpm typecheck
pnpm test
```

The shared test command builds first, so it also works directly after cleaning:

```powershell
pnpm --filter @nexus/shared test
```

Tests import the public package export, covering both the slug behavior and
the ability to load the compiled ES module. Node's built-in runner is enough
for this small utility checkpoint; Vitest and Playwright remain part of the
planned application testing stack.

## Next checkpoint

Sprint 1.2 adds `apps/web`, a Next.js-specific TypeScript configuration, and
the initial application shell consuming `@nexus/shared`. Database-backed
membership checks will be implemented with the authentication and tenant flows.
Shared role types alone do not enforce tenant isolation.

## Verification environment

The implementation session could use the existing Node, pnpm, TypeScript, and
Turbo installations, but registry access was unavailable and Windows denied
pnpm's workspace link creation. To execute the checks, the two static TypeScript
configuration files were copied into the shared package's ignored local
`node_modules` directory. This is a local verification workaround, not a tracked
dependency or an alternative installation process.

The root clean, build, typecheck, and test commands passed against that local
configuration. A fresh `pnpm install --frozen-lockfile` still needs verification
in a session that permits workspace links. The lockfile preserves the original
Turbo platform packages and adds the two new workspace importers.
