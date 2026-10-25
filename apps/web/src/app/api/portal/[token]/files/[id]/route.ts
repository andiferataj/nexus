import { collaborationService } from "../../../../../../lib/server";
import { fileResponse } from "../../../../../../lib/file-storage";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  try {
    return await fileResponse(
      await collaborationService.portalDownload(token, id),
    );
  } catch {
    return new Response("File unavailable.", {
      status: 404,
      headers: { "Referrer-Policy": "no-referrer" },
    });
  }
}
