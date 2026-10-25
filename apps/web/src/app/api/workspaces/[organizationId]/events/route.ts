import { auth } from "../../../../../auth";
import { operationsService } from "../../../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 65;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { organizationId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(organizationId))
    return new Response(null, { status: 400 });
  try {
    await operationsService.notifications(
      { userId: session.user.id },
      organizationId,
    );
  } catch {
    return new Response(null, { status: 403 });
  }
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false,
        busy = false;
      const interval = setInterval(() => {
        void emit();
      }, 10000);
      const deadline = setTimeout(() => cleanup(), 55000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearTimeout(deadline);
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      async function emit() {
        if (closed || busy) return;
        busy = true;
        try {
          if (Date.parse(session!.expires) <= Date.now()) {
            cleanup();
            return;
          }
          const records = await operationsService.notifications(
            { userId: session!.user.id },
            organizationId,
          );
          if (!closed)
            controller.enqueue(
              encoder.encode(
                `event: notifications\ndata: ${JSON.stringify({ unread: records.filter((record) => !record.readAt).length, signature: records.map((record) => `${record.id}:${record.readAt?.toISOString() ?? ""}`).join("|") })}\n\n`,
              ),
            );
        } catch {
          cleanup();
        } finally {
          busy = false;
        }
      }
      void emit();
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
