import { notFound } from "next/navigation";
import { DomainError } from "@nexus/contracts";
import { LiveWorkspace } from "../../../components/live-workspace";
import { subscriptionRequired } from "../../../lib/billing";
import {
  operationsService,
  organizationService,
  collaborationService,
  requireSession,
} from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Search = { view?: string; q?: string; status?: string; project?: string };
export default async function OrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Search>;
}) {
  const { organizationId } = await params;
  const session = await requireSession(`/workspaces/${organizationId}`);
  const actor = { userId: session.user.id },
    search = await searchParams;
  const text = (value: unknown) =>
    typeof value === "string" ? value.slice(0, 120) : "";
  try {
    const data = await operationsService.snapshot(actor, organizationId);
    const workspaces = await organizationService.list(actor);
    const extra = await collaborationService.snapshot(actor, organizationId);
    return (
      <LiveWorkspace
        subscriptionBlocked={await subscriptionRequired(organizationId)}
        extra={extra}
        data={data}
        workspaces={workspaces}
        name={session.user.name}
        userId={session.user.id}
        view={text(search.view)}
        query={text(search.q)}
        status={text(search.status)}
        projectId={text(search.project)}
      />
    );
  } catch (error) {
    if (
      error instanceof DomainError &&
      ["FORBIDDEN", "NOT_FOUND"].includes(error.code)
    )
      notFound();
    throw error;
  }
}
