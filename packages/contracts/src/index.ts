import { createOrganizationSlug } from "@nexus/shared";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_INVITATION";

export class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function parseObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new DomainError("VALIDATION", "Expected an object.");
  return input as Record<string, unknown>;
}

export function parseName(input: unknown): string {
  if (
    typeof input !== "string" ||
    input.trim().length < 2 ||
    input.trim().length > 80
  )
    throw new DomainError(
      "VALIDATION",
      "Names must contain between 2 and 80 characters.",
    );
  return input.trim();
}

export function parseEmail(input: unknown): string {
  if (typeof input !== "string")
    throw new DomainError("VALIDATION", "Enter a valid email address.");
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new DomainError("VALIDATION", "Enter a valid email address.");
  return email;
}

export function parseRegistration(input: unknown) {
  const data = parseObject(input);
  if (
    typeof data.password !== "string" ||
    data.password.length < 12 ||
    data.password.length > 128
  )
    throw new DomainError(
      "VALIDATION",
      "Use a password between 12 and 128 characters.",
    );
  return {
    name: parseName(data.name),
    email: parseEmail(data.email),
    password: data.password,
  };
}

export function parseAgency(input: unknown) {
  const data = parseObject(input);
  const name = parseName(data.name);
  const slug =
    data.slug === undefined ? createOrganizationSlug(name) : data.slug;
  if (
    typeof slug !== "string" ||
    slug.length < 2 ||
    slug.length > 63 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    throw new DomainError(
      "VALIDATION",
      "Use a URL name of 2–63 lowercase letters, numbers, or single hyphens.",
    );
  return { name, slug };
}

export function parseInvitation(input: unknown): {
  email: string;
  role: "ADMIN" | "MEMBER";
} {
  const data = parseObject(input);
  if (data.role !== "ADMIN" && data.role !== "MEMBER")
    throw new DomainError(
      "VALIDATION",
      "Invite someone as an admin or member.",
    );
  return { email: parseEmail(data.email), role: data.role };
}

export function parseText(input: unknown, maximum = 2000): string {
  if (input === undefined || input === null) return "";
  if (typeof input !== "string" || input.length > maximum)
    throw new DomainError(
      "VALIDATION",
      `Use no more than ${maximum} characters.`,
    );
  return input.trim();
}

export function parseIdentifier(input: unknown): string {
  if (typeof input !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(input))
    throw new DomainError("VALIDATION", "Choose a valid record.");
  return input;
}

export function parseOptionalId(input: unknown): string | null {
  return input === undefined || input === null || input === ""
    ? null
    : parseIdentifier(input);
}

export function parseDueDate(input: unknown): Date | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input))
    throw new DomainError("VALIDATION", "Choose a valid due date.");
  const value = new Date(`${input}T12:00:00Z`);
  if (
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== input
  )
    throw new DomainError("VALIDATION", "Choose a valid due date.");
  return value;
}

export function parseBudget(input: unknown): number {
  if (input === undefined || input === null || input === "") return 0;
  if (typeof input !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(input.trim()))
    throw new DomainError(
      "VALIDATION",
      "Enter a budget from 0 to 9,999,999.99 with at most two decimal places.",
    );
  const [whole = "0", fraction = ""] = input.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export const projectStatuses = [
  "PLANNED",
  "ACTIVE",
  "REVIEW",
  "COMPLETED",
  "ARCHIVED",
] as const;
export const taskStatuses = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const priorities = ["LOW", "NORMAL", "HIGH"] as const;

function choice<const T extends readonly string[]>(
  input: unknown,
  values: T,
  fallback: T[number],
): T[number] {
  if (input === undefined || input === null || input === "") return fallback;
  if (typeof input !== "string" || !values.includes(input))
    throw new DomainError("VALIDATION", "Choose a valid option.");
  return input as T[number];
}

export function parseClient(input: unknown) {
  const data = parseObject(input);
  return {
    name: parseName(data.name),
    email: data.email ? parseEmail(data.email) : "",
    company: parseText(data.company, 120),
    notes: parseText(data.notes),
  };
}

export function parseProject(input: unknown) {
  const data = parseObject(input);
  return {
    name: parseName(data.name),
    description: parseText(data.description),
    clientId: parseOptionalId(data.clientId),
    status: choice(data.status, projectStatuses, "PLANNED"),
    budgetCents: parseBudget(data.budget),
    dueDate: parseDueDate(data.dueDate),
  };
}

export function parseTask(input: unknown) {
  const data = parseObject(input);
  return {
    title: parseName(data.title),
    description: parseText(data.description),
    projectId: parseIdentifier(data.projectId),
    assigneeId: parseOptionalId(data.assigneeId),
    status: choice(data.status, taskStatuses, "TODO"),
    priority: choice(data.priority, priorities, "NORMAL"),
    dueDate: parseDueDate(data.dueDate),
  };
}
