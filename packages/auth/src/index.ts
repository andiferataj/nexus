import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { DomainError, parseEmail, parseRegistration } from "@nexus/contracts";
import type { Repository } from "@nexus/core";

const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, parameters, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128)
    throw new DomainError(
      "VALIDATION",
      "Use a password between 12 and 128 characters.",
    );
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt-v1$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (
    password.length > 128 ||
    !/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored)
  )
    return false;
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}

let dummyHash: Promise<string> | undefined;

export async function registerAccount(repository: Repository, input: unknown) {
  const data = parseRegistration(input);
  const passwordHash = await hashPassword(data.password);
  return repository.transaction(async (transaction) => {
    if (await transaction.findUserByEmail(data.email))
      throw new DomainError(
        "CONFLICT",
        "An account with this email already exists.",
      );
    const user = await transaction.insertUser({
      name: data.name,
      email: data.email,
      passwordHash,
    });
    return { id: user.id, name: user.name, email: user.email };
  });
}

export async function authenticateAccount(
  repository: Repository,
  emailInput: unknown,
  password: unknown,
  now: Date = new Date(),
) {
  if (typeof password !== "string" || password.length > 128) return null;
  let email: string;
  try {
    email = parseEmail(emailInput);
  } catch {
    return null;
  }
  const attemptKey = createHash("sha256")
    .update(`sign-in:${email}`)
    .digest("hex");
  const allowed = await repository.transaction((transaction) =>
    transaction.consumeAuthAttempt(attemptKey, now, 15 * 60 * 1000, 10),
  );
  if (!allowed) return null;
  dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
  const fallback = await dummyHash;
  const user = await repository.transaction((transaction) =>
    transaction.findUserByEmail(email),
  );
  const valid = await verifyPassword(password, user?.passwordHash ?? fallback);
  if (!valid || !user || !user.passwordHash) return null;
  await repository.transaction((transaction) =>
    transaction.clearAuthAttempts(attemptKey),
  );
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    sessionVersion: user.sessionVersion,
  };
}

export async function requestPasswordReset(
  repository: Repository,
  input: unknown,
  deliver: (email: string, token: string) => Promise<void>,
  now: Date = new Date(),
): Promise<void> {
  let email: string;
  try {
    email = parseEmail(input);
  } catch {
    return;
  }
  const key = createHash("sha256")
    .update(`password-reset:${email}`)
    .digest("hex");
  const token = randomBytes(32).toString("hex"),
    hash = createHash("sha256").update(token).digest("hex");
  const recipient = await repository.transaction(async (tx) => {
    if (!(await tx.consumeAuthAttempt(key, now, 60 * 60 * 1000, 5)))
      return null;
    const user = await tx.findUserByEmail(email);
    if (!user) return null;
    await tx.replaceResetToken(
      `password-reset:${user.id}`,
      hash,
      new Date(now.getTime() + 60 * 60 * 1000),
    );
    return user.email;
  });
  if (recipient) await deliver(recipient, token);
}

export async function resetPassword(
  repository: Repository,
  token: unknown,
  password: unknown,
  now: Date = new Date(),
): Promise<void> {
  const invalid = () =>
    new DomainError("VALIDATION", "This reset link is invalid or expired.");
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw invalid();
  const hash = createHash("sha256").update(token).digest("hex");
  const candidate = await repository.transaction((tx) =>
    tx.findResetToken(hash),
  );
  if (
    !candidate ||
    candidate.expires <= now ||
    !candidate.identifier.startsWith("password-reset:")
  )
    throw invalid();
  if (typeof password !== "string")
    throw new DomainError("VALIDATION", "Enter a new password.");
  const passwordHash = await hashPassword(password);
  await repository.transaction(async (tx) => {
    const record = await tx.findResetToken(hash);
    if (
      !record ||
      record.expires <= now ||
      record.identifier !== candidate.identifier ||
      !(await tx.consumeResetToken(hash, now))
    )
      throw invalid();
    const userId = record.identifier.slice("password-reset:".length);
    if (!(await tx.findUserById(userId))) throw invalid();
    await tx.changePassword(userId, passwordHash);
  });
}

export async function requestEmailVerification(
  repository: Repository,
  userId: string,
  deliver: (email: string, token: string) => Promise<void>,
  now = new Date(),
): Promise<void> {
  const token = randomBytes(32).toString("hex"),
    hash = createHash("sha256").update(token).digest("hex"),
    key = createHash("sha256").update(`verify-email:${userId}`).digest("hex");
  const email = await repository.transaction(async (tx) => {
    const user = await tx.findUserById(userId);
    if (!user || user.emailVerified) return null;
    if (!(await tx.consumeAuthAttempt(key, now, 60 * 60 * 1000, 5)))
      throw new DomainError(
        "VALIDATION",
        "Too many verification requests. Try again later.",
      );
    await tx.replaceResetToken(
      `verify-email:${userId}`,
      hash,
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
    );
    return user.email;
  });
  if (email) await deliver(email, token);
}

export async function verifyAccountEmail(
  repository: Repository,
  token: unknown,
  now = new Date(),
): Promise<void> {
  const invalid = () =>
    new DomainError(
      "VALIDATION",
      "This verification link is invalid or expired.",
    );
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw invalid();
  const hash = createHash("sha256").update(token).digest("hex");
  await repository.transaction(async (tx) => {
    const record = await tx.findResetToken(hash);
    if (
      !record ||
      !record.identifier.startsWith("verify-email:") ||
      record.expires <= now ||
      !(await tx.consumeResetToken(hash, now))
    )
      throw invalid();
    const userId = record.identifier.slice("verify-email:".length);
    if (!(await tx.findUserById(userId))) throw invalid();
    await tx.verifyEmail(userId, now);
  });
}
