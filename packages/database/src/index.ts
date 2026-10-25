import { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "@nexus/contracts";
import type {
  Repository,
  OperationsRepository,
  CollaborationRepository,
  CollaborationTransaction,
} from "@nexus/core";

const globalDatabase = globalThis as unknown as {
  nexusDatabase?: PrismaClient;
};
export const database = globalDatabase.nexusDatabase ?? new PrismaClient();
if (process.env.NODE_ENV !== "production")
  globalDatabase.nexusDatabase = database;

function transactionAdapter(
  transaction: Prisma.TransactionClient,
): CollaborationTransaction {
  return {
    findUserById: (id) => transaction.user.findUnique({ where: { id } }),
    findUserByEmail: (email) =>
      transaction.user.findUnique({ where: { email } }),
    insertUser: (data) => transaction.user.create({ data }),
    findOrganizationById: (id) =>
      transaction.organization.findUnique({ where: { id } }),
    findOrganizationBySlug: (slug) =>
      transaction.organization.findUnique({ where: { slug } }),
    insertOrganization: (data) => transaction.organization.create({ data }),
    findMembership: (userId, organizationId) =>
      transaction.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      }),
    listOrganizations: async (userId) => {
      const memberships = await transaction.membership.findMany({
        where: { userId },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });
      return memberships.map(({ organization, ...membership }) => ({
        organization,
        membership,
      }));
    },
    listMembers: async (organizationId) => {
      const memberships = await transaction.membership.findMany({
        where: { organizationId },
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return memberships.map((membership) => ({
        membershipId: membership.id,
        userId: membership.userId,
        role: membership.role,
        createdAt: membership.createdAt,
        name: membership.user.name,
        email: membership.user.email,
      }));
    },
    insertMembership: (data) =>
      transaction.membership.upsert({
        where: {
          userId_organizationId: {
            userId: data.userId,
            organizationId: data.organizationId,
          },
        },
        create: data,
        update: {},
      }),
    replaceInvitation: (data) =>
      transaction.invitation.upsert({
        where: {
          organizationId_email: {
            organizationId: data.organizationId,
            email: data.email,
          },
        },
        create: data,
        update: { ...data, acceptedAt: null, acceptedById: null },
      }),
    findInvitationByHash: (tokenHash) =>
      transaction.invitation.findUnique({ where: { tokenHash } }),
    consumeInvitation: async (id, userId, now) => {
      const result = await transaction.invitation.updateMany({
        where: { id, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now, acceptedById: userId },
      });
      return result.count === 1;
    },
    consumeAuthAttempt: async (key, now, windowMs, limit) => {
      const existing = await transaction.authAttempt.findUnique({
        where: { key },
      });
      if (
        !existing ||
        now.getTime() - existing.windowStartedAt.getTime() >= windowMs
      ) {
        await transaction.authAttempt.upsert({
          where: { key },
          create: { key, windowStartedAt: now, attempts: 1 },
          update: { windowStartedAt: now, attempts: 1 },
        });
        return true;
      }
      if (existing.attempts >= limit) return false;
      await transaction.authAttempt.update({
        where: { key },
        data: { attempts: { increment: 1 } },
      });
      return true;
    },
    clearAuthAttempts: async (key) => {
      await transaction.authAttempt.deleteMany({ where: { key } });
    },
    replaceResetToken: async (identifier, token, expires) => {
      await transaction.verificationToken.deleteMany({ where: { identifier } });
      await transaction.verificationToken.create({
        data: { identifier, token, expires },
      });
    },
    findResetToken: (token) =>
      transaction.verificationToken.findUnique({ where: { token } }),
    consumeResetToken: async (token, now) =>
      (
        await transaction.verificationToken.deleteMany({
          where: { token, expires: { gt: now } },
        })
      ).count === 1,
    changePassword: async (id, passwordHash) => {
      await transaction.user.update({
        where: { id },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
    },
    verifyEmail: async (id, now) => {
      await transaction.user.update({
        where: { id },
        data: { emailVerified: now },
      });
    },
    listClients: (organizationId) =>
      transaction.client.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      }),
    findClient: (id, organizationId) =>
      transaction.client.findUnique({
        where: { id_organizationId: { id, organizationId } },
      }),
    saveClient: (id, organizationId, data) =>
      id
        ? transaction.client.update({
            where: { id_organizationId: { id, organizationId } },
            data,
          })
        : transaction.client.create({ data: { ...data, organizationId } }),
    deleteClient: async (id, organizationId) => {
      await transaction.client.delete({
        where: { id_organizationId: { id, organizationId } },
      });
    },
    listProjects: (organizationId) =>
      transaction.project.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      }),
    findProject: (id, organizationId) =>
      transaction.project.findUnique({
        where: { id_organizationId: { id, organizationId } },
      }),
    saveProject: (id, organizationId, data) =>
      id
        ? transaction.project.update({
            where: { id_organizationId: { id, organizationId } },
            data,
          })
        : transaction.project.create({ data: { ...data, organizationId } }),
    deleteProject: async (id, organizationId) => {
      await transaction.project.delete({
        where: { id_organizationId: { id, organizationId } },
      });
    },
    listTasks: (organizationId) =>
      transaction.task.findMany({
        where: { organizationId },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
    findTask: (id, organizationId) =>
      transaction.task.findFirst({ where: { id, organizationId } }),
    saveTask: (id, organizationId, createdById, data) =>
      id
        ? transaction.task.update({ where: { id, organizationId }, data })
        : transaction.task.create({
            data: { ...data, organizationId, createdById },
          }),
    deleteTask: async (id, organizationId) => {
      await transaction.task.delete({ where: { id, organizationId } });
    },
    writeAudit: async (data) => {
      await transaction.auditEvent.create({ data });
    },
    listAudit: (organizationId) =>
      transaction.auditEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    notify: async (data) => {
      await transaction.notification.create({ data });
    },
    listNotifications: (organizationId, recipientId) =>
      transaction.notification.findMany({
        where: { organizationId, recipientId },
        orderBy: [
          { readAt: { sort: "desc", nulls: "first" } },
          { createdAt: "desc" },
        ],
        take: 50,
      }),
    markNotificationRead: async (id, organizationId, recipientId) => {
      await transaction.notification.updateMany({
        where: { id, organizationId, recipientId, readAt: null },
        data: { readAt: new Date() },
      });
    },
    setMemberRole: async (userId, organizationId, role) => {
      await transaction.membership.update({
        where: { userId_organizationId: { userId, organizationId } },
        data: { role },
      });
    },
    removeMember: async (userId, organizationId) => {
      await transaction.task.updateMany({
        where: { organizationId, assigneeId: userId },
        data: { assigneeId: null },
      });
      await transaction.membership.delete({
        where: { userId_organizationId: { userId, organizationId } },
      });
    },
    renameOrganization: async (id, name) => {
      await transaction.organization.update({ where: { id }, data: { name } });
    },
    withdrawProjectFiles: async (organizationId, projectId) => {
      await transaction.projectFile.updateMany({
        where: { organizationId, projectId },
        data: {
          published: false,
          reviewStatus: "PENDING",
          reviewNote: "",
          reviewedAt: null,
        },
      });
    },
    listContacts: (org) =>
      transaction.contact.findMany({
        where: { organizationId: org },
        orderBy: { createdAt: "asc" },
      }),
    saveContact: (organizationId, data) =>
      transaction.contact.create({ data: { organizationId, ...data } }),
    deleteContact: async (org, id) => {
      await transaction.contact.deleteMany({
        where: { id, organizationId: org },
      });
    },
    listComments: (org) =>
      transaction.taskComment.findMany({
        where: { organizationId: org },
        orderBy: { createdAt: "asc" },
      }),
    insertComment: (data) => transaction.taskComment.create({ data }),
    findComment: (org, id) =>
      transaction.taskComment.findFirst({ where: { id, organizationId: org } }),
    deleteComment: async (org, id) => {
      await transaction.taskComment.deleteMany({
        where: { id, organizationId: org },
      });
    },
    listFiles: (org) =>
      transaction.projectFile.findMany({
        where: { organizationId: org },
        orderBy: { createdAt: "desc" },
      }),
    findFile: (org, id) =>
      transaction.projectFile.findFirst({ where: { id, organizationId: org } }),
    insertFile: (data) => transaction.projectFile.create({ data }),
    updateFile: async (org, id, data) => {
      await transaction.projectFile.update({
        where: { id, organizationId: org },
        data,
      });
    },
    deleteFile: async (org, id) => {
      await transaction.projectFile.delete({
        where: { id, organizationId: org },
      });
    },
    listPortalAccess: (org) =>
      transaction.portalAccess.findMany({
        where: { organizationId: org },
        orderBy: { createdAt: "desc" },
      }),
    replacePortalAccess: (data) =>
      transaction.portalAccess.upsert({
        where: {
          clientId_organizationId: {
            clientId: data.clientId,
            organizationId: data.organizationId,
          },
        },
        create: data,
        update: { ...data, revokedAt: null },
      }),
    revokePortalAccess: async (org, id, now) => {
      await transaction.portalAccess.updateMany({
        where: { id, organizationId: org },
        data: { revokedAt: now },
      });
    },
    findPortalAccess: (tokenHash) =>
      transaction.portalAccess.findUnique({ where: { tokenHash } }),
  };
}

export class PrismaRepository
  implements Repository, OperationsRepository, CollaborationRepository
{
  private readonly client: PrismaClient;

  constructor(client: PrismaClient = database) {
    this.client = client;
  }

  async transaction<T>(
    operation: (transaction: CollaborationTransaction) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.client.$transaction(
          (transaction) => operation(transactionAdapter(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2034" && attempt < 2) continue;
          if (error.code === "P2002")
            throw new DomainError(
              "CONFLICT",
              "This email or workspace URL is already in use.",
            );
        }
        throw error;
      }
    }
    throw new Error("Transaction retry limit reached.");
  }
}

export const repository = new PrismaRepository();
