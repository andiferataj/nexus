import { createHash, randomBytes } from "node:crypto";
import { DomainError, parseAgency, parseInvitation } from "@nexus/contracts";
import type { OrganizationRole } from "@nexus/shared";
import type { Actor, Repository, RepositoryTransaction } from "./repository.js";

export { OperationsService } from "./operations.js";
export { verifyStripeSignature } from "./stripe.js";
export { encryptEmailJob, decryptEmailJob } from "./email-jobs.js";
export type { EmailPayload } from "./email-jobs.js";
export type {
  OperationsRepository,
  OperationsTransaction,
  ClientRecord,
  ProjectRecord,
  TaskRecord,
  AuditRecord,
  NotificationRecord,
} from "./operations.js";

export type {
  AccountUser,
  Actor,
  Invitation,
  OrganizationAccess,
  Repository,
  RepositoryTransaction,
  WorkspaceMember,
} from "./repository.js";

export function requireUser(actor: Actor): string {
  if (!actor.userId)
    throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
  return actor.userId;
}

export async function requireMembership(
  transaction: RepositoryTransaction,
  actor: Actor,
  organizationId: string,
  roles?: readonly OrganizationRole[],
) {
  const userId = requireUser(actor);
  const membership = await transaction.findMembership(userId, organizationId);
  if (!membership || (roles && !roles.includes(membership.role)))
    throw new DomainError(
      "FORBIDDEN",
      "You do not have access to this workspace action.",
    );
  return membership;
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class OrganizationService {
  private readonly repository: Repository;
  private readonly now: () => Date;

  constructor(repository: Repository, now: () => Date = () => new Date()) {
    this.repository = repository;
    this.now = now;
  }

  async create(actor: Actor, input: unknown) {
    const userId = requireUser(actor);
    const data = parseAgency(input);
    return this.repository.transaction(async (transaction) => {
      if (!(await transaction.findUserById(userId)))
        throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
      if (await transaction.findOrganizationBySlug(data.slug))
        throw new DomainError(
          "CONFLICT",
          "That workspace URL is already in use.",
        );
      const organization = await transaction.insertOrganization(data);
      const membership = await transaction.insertMembership({
        userId,
        organizationId: organization.id,
        role: "OWNER",
      });
      return { organization, membership };
    });
  }

  async list(actor: Actor) {
    const userId = requireUser(actor);
    return this.repository.transaction((transaction) =>
      transaction.listOrganizations(userId),
    );
  }

  async access(actor: Actor, organizationId: string) {
    return this.repository.transaction(async (transaction) => {
      const membership = await requireMembership(
        transaction,
        actor,
        organizationId,
      );
      const organization =
        await transaction.findOrganizationById(organizationId);
      if (!organization)
        throw new DomainError("NOT_FOUND", "Workspace not found.");
      return { organization, membership };
    });
  }

  async members(actor: Actor, organizationId: string) {
    return this.repository.transaction(async (transaction) => {
      await requireMembership(transaction, actor, organizationId);
      return transaction.listMembers(organizationId);
    });
  }

  async invite(actor: Actor, organizationId: string, input: unknown) {
    requireUser(actor);
    const data = parseInvitation(input);
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(this.now().getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.repository.transaction(async (transaction) => {
      const inviter = await requireMembership(
        transaction,
        actor,
        organizationId,
        ["OWNER", "ADMIN"],
      );
      if (inviter.role === "ADMIN" && data.role === "ADMIN")
        throw new DomainError(
          "FORBIDDEN",
          "Only an owner can invite an admin.",
        );
      const existingUser = await transaction.findUserByEmail(data.email);
      if (
        existingUser &&
        (await transaction.findMembership(existingUser.id, organizationId))
      )
        throw new DomainError(
          "CONFLICT",
          "This person already belongs to the workspace.",
        );
      await transaction.replaceInvitation({
        organizationId,
        invitedById: inviter.userId,
        email: data.email,
        role: data.role,
        tokenHash,
        expiresAt,
      });
    });
    return { token, expiresAt };
  }

  async acceptInvitation(actor: Actor, token: unknown) {
    const userId = requireUser(actor);
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new DomainError(
        "INVALID_INVITATION",
        "This invitation is invalid or expired.",
      );
    const tokenHash = hashInvitationToken(token);
    return this.repository.transaction(async (transaction) => {
      const now = this.now();
      const user = await transaction.findUserById(userId);
      const invitation = await transaction.findInvitationByHash(tokenHash);
      if (
        !user ||
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt <= now ||
        invitation.email !== user.email
      )
        throw new DomainError(
          "INVALID_INVITATION",
          "This invitation is invalid or expired.",
        );
      const inviter = await transaction.findMembership(
        invitation.invitedById,
        invitation.organizationId,
      );
      if (
        !inviter ||
        inviter.role === "MEMBER" ||
        (inviter.role === "ADMIN" && invitation.role === "ADMIN")
      )
        throw new DomainError(
          "INVALID_INVITATION",
          "This invitation is invalid or expired.",
        );
      if (!(await transaction.consumeInvitation(invitation.id, userId, now)))
        throw new DomainError(
          "INVALID_INVITATION",
          "This invitation is invalid or expired.",
        );
      const membership = await transaction.insertMembership({
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
      });
      return { organizationId: invitation.organizationId, membership };
    });
  }
}
export { CollaborationService, maximumFileBytes } from "./collaboration.js";
export type {
  CollaborationRepository,
  CollaborationTransaction,
  ContactRecord,
  CommentRecord,
  FileRecord,
  PortalRecord,
  ReviewStatus,
} from "./collaboration.js";
