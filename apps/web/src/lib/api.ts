import "server-only";
import { DomainError } from "@nexus/contracts";
import { auth } from "../auth";
import { repository } from "@nexus/database";
import { emailConfigured } from "./mail";

export async function apiActor() {
  const session = await auth();
  if (!session?.user?.id)
    throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
  if (
    emailConfigured() &&
    !(await repository.transaction((tx) => tx.findUserById(session.user.id)))
      ?.emailVerified
  )
    throw new DomainError(
      "FORBIDDEN",
      "Verify your email before using the workspace.",
    );
  return { userId: session.user.id };
}
export async function apiInput(request: Request): Promise<unknown> {
  const origin = process.env.APP_URL ?? "http://127.0.0.1:3000";
  if (request.headers.get("origin") !== new URL(origin).origin)
    throw new DomainError("FORBIDDEN", "A matching Origin header is required.");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new DomainError("VALIDATION", "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("VALIDATION", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > 65536) {
      await reader.cancel();
      throw new DomainError("VALIDATION", "Request body is too large.");
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new DomainError("VALIDATION", "Use a valid JSON body.");
  }
}
export function apiError(error: unknown): Response {
  if (error instanceof DomainError) {
    const status =
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code === "FORBIDDEN" || error.code === "NOT_FOUND"
          ? 404
          : error.code === "CONFLICT"
            ? 409
            : 400;
    return Response.json(
      {
        error: {
          code: error.code,
          message: status === 404 ? "Resource unavailable." : error.message,
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error(
    "Nexus API failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error: {
        code: "INTERNAL",
        message: "The request could not be completed.",
      },
    },
    { status: 500 },
  );
}
export function apiData(data: unknown, status = 200) {
  return Response.json(
    { data },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
