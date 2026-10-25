# Sprint 1.2: Application shell

The root page is an explicitly labeled demo with a responsive sidebar, agency
switching, overview metrics, project/team views, search, status filtering, and a
new-project dialog. React state holds demo changes until refresh.

| File                                         | What to learn                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `tooling/typescript/nextjs.json`             | DOM types, bundler resolution, JSX, and the Next compiler plugin.                      |
| `apps/web/next.config.mjs`                   | Shared-package transpilation and strict React behavior.                                |
| `apps/web/src/app/layout.tsx`                | The document shell, metadata, and global CSS.                                          |
| `apps/web/src/app/page.tsx`                  | A server component rendering the interactive client workspace.                         |
| `apps/web/src/lib/workspace.ts`              | Typed demo records, integer money, derived metrics, filtering, and project validation. |
| `apps/web/src/components/workspace-app.tsx`  | React state and view composition.                                                      |
| `apps/web/src/components/project-dialog.tsx` | Native modal behavior, validation, initial focus, and focus restoration.               |
| `apps/web/src/components/icon.tsx`           | A typed SVG icon set without another dependency.                                       |
| `apps/web/src/app/globals.css`               | Colors, responsive layout, focus styles, and components.                               |
| `apps/web/test/e2e/workspace.spec.ts`        | Chromium interaction tests.                                                            |

`WorkspaceApp` uses `use client` because it needs state and browser events. Its
parent page remains a server component. The organization slug helper is imported
through the shared package's public export. Type-only imports vanish at runtime.
Budgets use integer cents, and zero-task progress is handled explicitly.

The demo/client component TypeScript check passes. Six browser tests pass:
rendering, workspace switching, combined filtering, project creation/refresh,
modal focus and Escape, and mobile navigation without page overflow.

Browser requests to the local HTTP server were blocked, so verification used an
esbuild bundle of the actual React components loaded from a local file. Cached
dependencies were copied into ignored folders after integrity verification. This
checks the UI, not Next.js routing or its production build. The tracked Playwright
configuration targets a real Next.js server by default; `NEXUS_TEST_DOCUMENT`
supports the file-based verification path.
