import "server-only";
import { redirect } from "next/navigation";
import {
  OrganizationService,
  OperationsService,
  CollaborationService,
} from "@nexus/core";
import { repository } from "@nexus/database";
import { auth } from "../auth";
import { safeReturnPath } from "./form-state";
import { emailConfigured } from "./mail";

export const organizationService = new OrganizationService(repository);
export const operationsService = new OperationsService(repository);
export const collaborationService = new CollaborationService(repository);

export async function requireSession(returnTo: string = "/workspaces") {
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/sign-in?next=${encodeURIComponent(safeReturnPath(returnTo))}`);
  if (emailConfigured()) {
    const account = await repository.transaction((tx) =>
      tx.findUserById(session.user.id),
    );
    if (!account?.emailVerified) redirect("/verify-email");
  }
  return session;
}
