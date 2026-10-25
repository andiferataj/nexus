import { auth } from "../../../../../../auth";
import { collaborationService } from "../../../../../../lib/server";
import { fileResponse } from "../../../../../../lib/file-storage";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { organizationId, id } = await params;
  try {
    return await fileResponse(
      await collaborationService.download(
        { userId: session.user.id },
        organizationId,
        id,
      ),
    );
  } catch {
    return new Response("File unavailable.", { status: 404 });
  }
}
