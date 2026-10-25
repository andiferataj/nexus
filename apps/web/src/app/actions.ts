"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import {
  registerAccount,
  requestPasswordReset,
  resetPassword,
  requestEmailVerification,
  verifyAccountEmail,
} from "@nexus/auth";
import {
  emailConfigured,
  sendResetEmail,
  sendVerificationEmail,
} from "../lib/mail";
import { billingDestination, requireWorkspaceWrite } from "../lib/billing";
import { DomainError } from "@nexus/contracts";
import { repository } from "@nexus/database";
import { auth, signIn, signOut } from "../auth";
import {
  organizationService,
  operationsService,
  collaborationService,
  requireSession,
} from "../lib/server";
import { requireMembership } from "@nexus/core";
import { storeFile, deleteStoredFile } from "../lib/file-storage";
import { safeReturnPath } from "../lib/form-state";
import type { FormState } from "../lib/form-state";

function actionError(error: unknown): FormState {
  if (error instanceof DomainError) return { error: error.message };
  console.error(
    "Nexus action failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return { error: "This action could not be completed. Try again." };
}

export async function signInAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: safeReturnPath(form.get("returnTo")),
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError)
      return { error: "We couldn’t sign you in with those credentials." };
    throw error;
  }
}

export async function registerAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const requestHeaders = await headers();
    const address =
      process.env.TRUST_PROXY === "true"
        ? (requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown")
        : "local";
    const key = createHash("sha256").update(`signup:${address}`).digest("hex");
    const allowed = await repository.transaction((tx) =>
      tx.consumeAuthAttempt(key, new Date(), 60 * 60 * 1000, 20),
    );
    if (!allowed)
      return { error: "Too many account creation attempts. Try again later." };
    await registerAccount(repository, {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
  } catch (error) {
    return actionError(error);
  }
  return signInAction({ error: null }, form);
}

export async function createAgencyAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await requireSession();
  let organizationId: string;
  const slug = form.get("slug");
  try {
    const result = await organizationService.create(
      { userId: session.user.id },
      {
        name: form.get("name"),
        ...(typeof slug === "string" && slug.trim()
          ? { slug: slug.trim() }
          : {}),
      },
    );
    organizationId = result.organization.id;
  } catch (error) {
    return actionError(error);
  }
  redirect(`/workspaces/${organizationId}`);
}

export async function inviteColleagueAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const organizationId = form.get("organizationId");
  if (typeof organizationId !== "string")
    return { error: "Choose a workspace first." };
  try {
    const invitation = await organizationService.invite(
      { userId: session.user.id },
      organizationId,
      { email: form.get("email"), role: form.get("role") },
    );
    const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";
    const url = new URL("/invite", baseUrl);
    url.searchParams.set("token", invitation.token);
    return { error: null, invitationUrl: url.toString() };
  } catch (error) {
    return actionError(error);
  }
}

export async function acceptInvitationAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const token = form.get("token");
  const session = await requireSession(
    typeof token === "string" ? `/invite?token=${token}` : "/workspaces",
  );
  let organizationId: string;
  try {
    const result = await organizationService.acceptInvitation(
      { userId: session.user.id },
      token,
    );
    organizationId = result.organizationId;
  } catch (error) {
    return actionError(error);
  }
  redirect(`/workspaces/${organizationId}`);
}

export async function switchWorkspaceAction(form: FormData): Promise<void> {
  const session = await requireSession();
  const organizationId = form.get("organizationId");
  if (typeof organizationId !== "string") redirect("/workspaces");
  try {
    await organizationService.access(
      { userId: session.user.id },
      organizationId,
    );
  } catch (error) {
    if (error instanceof DomainError) redirect("/workspaces");
    throw error;
  }
  redirect(`/workspaces/${organizationId}`);
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}

export async function workspaceAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const organizationId = form.get("organizationId");
  if (
    typeof organizationId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(organizationId)
  )
    return { error: "Choose a workspace first." };
  const actor = { userId: session.user.id },
    input = Object.fromEntries(form),
    id = form.get("id");
  try {
    if (
      [
        "client.save",
        "project.save",
        "task.save",
        "contact.add",
        "comment.add",
        "portal.issue",
      ].includes(String(form.get("operation"))) ||
      (form.get("operation") === "file.publish" &&
        form.get("published") === "true")
    )
      await requireWorkspaceWrite({ userId: session.user.id }, organizationId);
    switch (form.get("operation")) {
      case "client.save":
        await operationsService.saveClient(actor, organizationId, input, id);
        break;
      case "project.save":
        await operationsService.saveProject(actor, organizationId, input, id);
        break;
      case "task.save":
        await operationsService.saveTask(actor, organizationId, input, id);
        break;
      case "client.delete":
        await operationsService.deleteRecord(
          actor,
          organizationId,
          "client",
          id,
        );
        break;
      case "project.delete":
        await operationsService.deleteRecord(
          actor,
          organizationId,
          "project",
          id,
        );
        break;
      case "task.delete":
        await operationsService.deleteRecord(actor, organizationId, "task", id);
        break;
      case "member.role":
        await operationsService.setMemberRole(
          actor,
          organizationId,
          form.get("userId"),
          form.get("role"),
        );
        break;
      case "member.remove":
        await operationsService.removeMember(
          actor,
          organizationId,
          form.get("userId"),
        );
        break;
      case "agency.rename":
        await operationsService.rename(actor, organizationId, form.get("name"));
        break;
      case "notification.read":
        await operationsService.markRead(actor, organizationId, id);
        break;
      case "contact.add":
        await collaborationService.addContact(actor, organizationId, input);
        break;
      case "contact.remove":
        await collaborationService.removeContact(actor, organizationId, id);
        break;
      case "comment.add":
        await collaborationService.addComment(actor, organizationId, input);
        break;
      case "comment.remove":
        await collaborationService.removeComment(actor, organizationId, id);
        break;
      case "file.publish":
        await collaborationService.setPublished(
          actor,
          organizationId,
          id,
          form.get("published") === "true",
        );
        break;
      case "file.remove": {
        const key = await collaborationService.removeFile(
          actor,
          organizationId,
          id,
        );
        await deleteStoredFile(key).catch(() =>
          console.error("File cleanup needs retry"),
        );
        break;
      }
      case "portal.revoke":
        await collaborationService.revokePortal(actor, organizationId, id);
        break;
      case "portal.issue": {
        const grant = await collaborationService.issuePortal(
          actor,
          organizationId,
          form.get("clientId"),
        );
        revalidatePath(`/workspaces/${organizationId}`);
        return {
          error: null,
          shareUrl: new URL(
            `/portal/${grant.token}`,
            process.env.APP_URL ?? "http://127.0.0.1:3000",
          ).toString(),
        };
      }
      default:
        return { error: "Choose a valid action." };
    }
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(`/workspaces/${organizationId}`);
  revalidatePath("/workspaces");
  return { error: null, message: "Changes saved." };
}

export async function requestResetAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  if (!emailConfigured())
    return {
      error:
        "Password reset email is not configured. Contact your agency owner.",
    };
  try {
    await requestPasswordReset(repository, form.get("email"), sendResetEmail);
  } catch {
    return { error: "The request could not be completed. Try again later." };
  }
  return {
    error: null,
    message:
      "If an account matches that email address, we will email a password reset link.",
  };
}

export async function resetPasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await resetPassword(repository, form.get("token"), form.get("password"));
  } catch (error) {
    return actionError(error);
  }
  return {
    error: null,
    message: "Your password has been updated. Sign in with your new password.",
  };
}

export async function billingAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await requireSession(),
    organizationId = form.get("organizationId");
  if (typeof organizationId !== "string")
    return { error: "Choose a workspace first." };
  let destination: string;
  try {
    destination = await billingDestination(
      session.user.id,
      organizationId,
      form.get("mode") === "portal" ? "portal" : "checkout",
    );
  } catch (error) {
    return actionError(error);
  }
  redirect(destination);
}

export async function uploadFileAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await requireSession(),
    org = form.get("organizationId"),
    file = form.get("file");
  if (typeof org !== "string" || !(file instanceof File))
    return { error: "Choose a workspace and file." };
  try {
    await repository.transaction((tx) =>
      requireMembership(tx, { userId: session.user.id }, org, [
        "OWNER",
        "ADMIN",
      ]),
    );
    await requireWorkspaceWrite({ userId: session.user.id }, org);
    const stored = await storeFile(file);
    try {
      await collaborationService.addFile({ userId: session.user.id }, org, {
        ...stored,
        title: form.get("title"),
        projectId: form.get("projectId"),
      });
    } catch (error) {
      await deleteStoredFile(stored.storageKey).catch(() => {});
      throw error;
    }
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(`/workspaces/${org}`);
  return {
    error: null,
    message:
      "File uploaded privately. Share it when it is ready for your client.",
  };
}

export async function reviewDeliverableAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await collaborationService.review(form.get("token"), {
      id: form.get("id"),
      status: form.get("status"),
      note: form.get("note"),
    });
  } catch (error) {
    return actionError(error);
  }
  const token = form.get("token");
  if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token))
    revalidatePath(`/portal/${token}`);
  return {
    error: null,
    message: "Your feedback has been shared with the agency.",
  };
}

export async function sendVerificationAction(): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (!emailConfigured())
    return { error: "Email verification is not enabled on this deployment." };
  try {
    await requestEmailVerification(
      repository,
      session.user.id,
      sendVerificationEmail,
    );
  } catch (error) {
    return actionError(error);
  }
  return {
    error: null,
    message:
      "Your verification email is queued. Check your inbox and spam folder.",
  };
}
export async function verifyEmailAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await verifyAccountEmail(repository, form.get("token"));
  } catch (error) {
    return actionError(error);
  }
  redirect("/workspaces");
}
