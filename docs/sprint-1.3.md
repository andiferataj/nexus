# Sprint 1.3: Multi-tenant services

| File                                        | Responsibility                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/contracts/src/index.ts`           | Runtime parsing, normalized emails, allowed roles, and domain errors.            |
| `packages/core/src/repository.ts`           | Persistence interface, users, memberships, and invitation records.               |
| `packages/core/src/index.ts`                | Agency transactions, current-membership authorization, and invitation lifecycle. |
| `packages/auth/src/index.ts`                | Registration, salted password hashing, verification, and sign-in throttling.     |
| `packages/core/test/memory-repository.mjs`  | Test-only transactional adapter with rollback and serialization.                 |
| `packages/core/test/organizations.test.mjs` | Authorization and invitation edge cases.                                         |
| `packages/auth/test/auth.test.mjs`          | Password behavior, public account identity, and throttling.                      |

Users are global; roles belong to a user's membership in a particular agency.
A form's agency ID selects the membership to check. It grants no access. The
trusted user ID must come from the authenticated server session.

Agency creation inserts the agency and its owner in one transaction. Reading a
team requires membership and returns no credential data. Owners can invite admins
or members; admins can invite members. Invitations cannot grant ownership.

Invitation tokens contain 32 random bytes; only a SHA-256 digest is stored. A link
expires after seven days. Acceptance requires the invited email, no prior use,
and an inviter who still has permission. Consumption and membership creation are
atomic. Stronger existing memberships are preserved. Reissuing invalidates the
old token. The app creates share links and does not send emails.

Passwords remain untrimmed and must contain 12-128 characters. Async scrypt uses
N=32768, r=8, p=3 with a fresh 128-bit salt. These parameters belong to the
`scrypt-v1` format and must not change without a format-version change. Verification
uses timing-safe comparison; unknown accounts still perform dummy verification.

Sign-in attempts are limited to ten per normalized email in fifteen minutes.
Counter keys contain an email digest. Successful authentication resets the
counter. The real adapter stores these counters in PostgreSQL for shared limits
across app instances. Signup/IP abuse controls, email verification, and password
recovery remain later work.

Packages compile under strict TypeScript. Tests cover tenant access denial, role
escalation, atomic creation, expiry, wrong email, replay, concurrent acceptance,
reissue, revoked inviters, rollback, and password limits. The test adapter verifies
service behavior; PostgreSQL isolation/index behavior still needs live testing.
