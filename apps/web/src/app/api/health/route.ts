import { database } from "@nexus/database";

export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  try {
    await database.user.findFirst({ select: { id: true } });
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
