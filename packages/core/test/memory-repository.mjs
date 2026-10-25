import { randomUUID } from "node:crypto";

export class MemoryRepository {
  state = {
    users: [],
    organizations: [],
    memberships: [],
    invitations: [],
    authAttempts: [],
    clients: [],
    projects: [],
    tasks: [],
    activity: [],
    notifications: [],
    resetTokens: [],
    contacts: [],
    comments: [],
    files: [],
    portalAccess: [],
  };
  queue = Promise.resolve();
  failMembership = false;

  async transaction(operation) {
    const previous = this.queue;
    let release;
    this.queue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    const snapshot = structuredClone(this.state);
    try {
      return await operation(this.transactionMethods());
    } catch (error) {
      this.state = snapshot;
      throw error;
    } finally {
      release();
    }
  }

  transactionMethods() {
    const state = this.state;
    return {
      findUserById: async (id) =>
        state.users.find((user) => user.id === id) ?? null,
      findUserByEmail: async (email) =>
        state.users.find((user) => user.email === email) ?? null,
      insertUser: async (data) => {
        const user = {
          id: randomUUID(),
          sessionVersion: 0,
          emailVerified: null,
          ...data,
        };
        state.users.push(user);
        return user;
      },
      findOrganizationById: async (id) =>
        state.organizations.find((org) => org.id === id) ?? null,
      findOrganizationBySlug: async (slug) =>
        state.organizations.find((org) => org.slug === slug) ?? null,
      insertOrganization: async (data) => {
        const organization = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.organizations.push(organization);
        return organization;
      },
      findMembership: async (userId, organizationId) =>
        state.memberships.find(
          (item) =>
            item.userId === userId && item.organizationId === organizationId,
        ) ?? null,
      listOrganizations: async (userId) =>
        state.memberships
          .filter((item) => item.userId === userId)
          .map((membership) => ({
            membership,
            organization: state.organizations.find(
              (org) => org.id === membership.organizationId,
            ),
          })),
      listMembers: async (organizationId) =>
        state.memberships
          .filter((membership) => membership.organizationId === organizationId)
          .map((membership) => {
            const user = state.users.find(
              (item) => item.id === membership.userId,
            );
            return {
              membershipId: membership.id,
              userId: user.id,
              name: user.name,
              email: user.email,
              role: membership.role,
              createdAt: membership.createdAt,
            };
          }),
      insertMembership: async (data) => {
        if (this.failMembership)
          throw new Error("Simulated membership failure");
        const existing = state.memberships.find(
          (item) =>
            item.userId === data.userId &&
            item.organizationId === data.organizationId,
        );
        if (existing) return existing;
        const membership = { id: randomUUID(), ...data, createdAt: new Date() };
        state.memberships.push(membership);
        return membership;
      },
      replaceInvitation: async (data) => {
        const existing = state.invitations.find(
          (item) =>
            item.organizationId === data.organizationId &&
            item.email === data.email,
        );
        if (existing) {
          Object.assign(existing, data, { acceptedAt: null });
          return existing;
        }
        const invitation = { id: randomUUID(), ...data, acceptedAt: null };
        state.invitations.push(invitation);
        return invitation;
      },
      findInvitationByHash: async (hash) =>
        state.invitations.find((item) => item.tokenHash === hash) ?? null,
      consumeInvitation: async (id, userId, now) => {
        const invitation = state.invitations.find(
          (item) => item.id === id && !item.acceptedAt && item.expiresAt > now,
        );
        if (!invitation) return false;
        invitation.acceptedAt = now;
        invitation.acceptedById = userId;
        return true;
      },
      consumeAuthAttempt: async (key, now, windowMs, limit) => {
        let attempt = state.authAttempts.find((item) => item.key === key);
        if (!attempt) {
          attempt = { key, windowStartedAt: now, attempts: 0 };
          state.authAttempts.push(attempt);
        }
        if (now.getTime() - attempt.windowStartedAt.getTime() >= windowMs) {
          attempt.windowStartedAt = now;
          attempt.attempts = 0;
        }
        if (attempt.attempts >= limit) return false;
        attempt.attempts++;
        return true;
      },
      clearAuthAttempts: async (key) => {
        state.authAttempts = state.authAttempts.filter(
          (item) => item.key !== key,
        );
      },
      replaceResetToken: async (identifier, token, expires) => {
        state.resetTokens = state.resetTokens.filter(
          (item) => item.identifier !== identifier,
        );
        state.resetTokens.push({ identifier, token, expires });
      },
      findResetToken: async (token) =>
        state.resetTokens.find((item) => item.token === token) ?? null,
      consumeResetToken: async (token, now) => {
        const record = state.resetTokens.find(
          (item) => item.token === token && item.expires > now,
        );
        if (!record) return false;
        state.resetTokens = state.resetTokens.filter((item) => item !== record);
        return true;
      },
      changePassword: async (id, passwordHash) => {
        const user = state.users.find((item) => item.id === id);
        user.passwordHash = passwordHash;
        user.sessionVersion++;
      },
      verifyEmail: async (id, now) => {
        state.users.find((item) => item.id === id).emailVerified = now;
      },
      listClients: async (org) =>
        state.clients.filter((item) => item.organizationId === org),
      findClient: async (id, org) =>
        state.clients.find(
          (item) => item.id === id && item.organizationId === org,
        ) ?? null,
      saveClient: async (id, organizationId, data) => {
        if (id) {
          const record = state.clients.find(
            (item) => item.id === id && item.organizationId === organizationId,
          );
          Object.assign(record, data, { updatedAt: new Date() });
          return record;
        }
        const record = {
          id: randomUUID(),
          organizationId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.clients.push(record);
        return record;
      },
      deleteClient: async (id, org) => {
        state.clients = state.clients.filter(
          (item) => !(item.id === id && item.organizationId === org),
        );
      },
      listProjects: async (org) =>
        state.projects.filter((item) => item.organizationId === org),
      findProject: async (id, org) =>
        state.projects.find(
          (item) => item.id === id && item.organizationId === org,
        ) ?? null,
      saveProject: async (id, organizationId, data) => {
        if (id) {
          const record = state.projects.find(
            (item) => item.id === id && item.organizationId === organizationId,
          );
          Object.assign(record, data, { updatedAt: new Date() });
          return record;
        }
        const record = {
          id: randomUUID(),
          organizationId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.projects.push(record);
        return record;
      },
      deleteProject: async (id, org) => {
        state.projects = state.projects.filter(
          (item) => !(item.id === id && item.organizationId === org),
        );
        state.tasks = state.tasks.filter(
          (item) => !(item.projectId === id && item.organizationId === org),
        );
      },
      listTasks: async (org) =>
        state.tasks.filter((item) => item.organizationId === org),
      findTask: async (id, org) =>
        state.tasks.find(
          (item) => item.id === id && item.organizationId === org,
        ) ?? null,
      saveTask: async (id, organizationId, createdById, data) => {
        if (id) {
          const record = state.tasks.find(
            (item) => item.id === id && item.organizationId === organizationId,
          );
          Object.assign(record, data, { updatedAt: new Date() });
          return record;
        }
        const record = {
          id: randomUUID(),
          organizationId,
          createdById,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.tasks.push(record);
        return record;
      },
      deleteTask: async (id, org) => {
        state.tasks = state.tasks.filter(
          (item) => !(item.id === id && item.organizationId === org),
        );
      },
      writeAudit: async (data) => {
        state.activity.push({
          ...data,
          id: randomUUID(),
          createdAt: new Date(),
        });
      },
      listAudit: async (org) =>
        state.activity.filter((item) => item.organizationId === org),
      notify: async (data) => {
        state.notifications.push({
          ...data,
          id: randomUUID(),
          readAt: null,
          createdAt: new Date(),
        });
      },
      listNotifications: async (org, user) =>
        state.notifications.filter(
          (item) => item.organizationId === org && item.recipientId === user,
        ),
      markNotificationRead: async (id, org, user) => {
        const record = state.notifications.find(
          (item) =>
            item.id === id &&
            item.organizationId === org &&
            item.recipientId === user,
        );
        if (record) record.readAt = new Date();
      },
      setMemberRole: async (user, org, role) => {
        state.memberships.find(
          (item) => item.userId === user && item.organizationId === org,
        ).role = role;
      },
      removeMember: async (user, org) => {
        state.memberships = state.memberships.filter(
          (item) => !(item.userId === user && item.organizationId === org),
        );
        for (const task of state.tasks)
          if (task.organizationId === org && task.assigneeId === user)
            task.assigneeId = null;
        state.notifications = state.notifications.filter(
          (item) => !(item.organizationId === org && item.recipientId === user),
        );
      },
      renameOrganization: async (id, name) => {
        state.organizations.find((item) => item.id === id).name = name;
      },
      withdrawProjectFiles: async (org, projectId) => {
        for (const file of state.files)
          if (file.organizationId === org && file.projectId === projectId)
            Object.assign(file, {
              published: false,
              reviewStatus: "PENDING",
              reviewNote: "",
              reviewedAt: null,
            });
      },
      listContacts: async (org) =>
        state.contacts.filter((item) => item.organizationId === org),
      saveContact: async (organizationId, data) => {
        const record = {
          id: randomUUID(),
          organizationId,
          ...data,
          createdAt: new Date(),
        };
        state.contacts.push(record);
        return record;
      },
      deleteContact: async (org, id) => {
        state.contacts = state.contacts.filter(
          (item) => !(item.id === id && item.organizationId === org),
        );
      },
      listComments: async (org) =>
        state.comments.filter((item) => item.organizationId === org),
      insertComment: async (data) => {
        const record = { id: randomUUID(), ...data, createdAt: new Date() };
        state.comments.push(record);
        return record;
      },
      findComment: async (org, id) =>
        state.comments.find(
          (item) => item.id === id && item.organizationId === org,
        ) ?? null,
      deleteComment: async (org, id) => {
        state.comments = state.comments.filter(
          (item) => !(item.id === id && item.organizationId === org),
        );
      },
      listFiles: async (org) =>
        state.files.filter((item) => item.organizationId === org),
      findFile: async (org, id) =>
        state.files.find(
          (item) => item.id === id && item.organizationId === org,
        ) ?? null,
      insertFile: async (data) => {
        const record = {
          id: randomUUID(),
          ...data,
          published: false,
          reviewStatus: "PENDING",
          reviewNote: "",
          reviewedAt: null,
          createdAt: new Date(),
        };
        state.files.push(record);
        return record;
      },
      updateFile: async (org, id, data) => {
        Object.assign(
          state.files.find(
            (item) => item.id === id && item.organizationId === org,
          ),
          data,
        );
      },
      deleteFile: async (org, id) => {
        state.files = state.files.filter(
          (item) => !(item.id === id && item.organizationId === org),
        );
      },
      listPortalAccess: async (org) =>
        state.portalAccess.filter((item) => item.organizationId === org),
      replacePortalAccess: async (data) => {
        let grant = state.portalAccess.find(
          (item) =>
            item.clientId === data.clientId &&
            item.organizationId === data.organizationId,
        );
        if (grant) Object.assign(grant, data, { revokedAt: null });
        else {
          grant = {
            id: randomUUID(),
            ...data,
            revokedAt: null,
            createdAt: new Date(),
          };
          state.portalAccess.push(grant);
        }
        return grant;
      },
      revokePortalAccess: async (org, id, now) => {
        const grant = state.portalAccess.find(
          (item) => item.id === id && item.organizationId === org,
        );
        if (grant) grant.revokedAt = now;
      },
      findPortalAccess: async (hash) =>
        state.portalAccess.find((item) => item.tokenHash === hash) ?? null,
    };
  }
}

export async function fixture() {
  const repository = new MemoryRepository();
  for (const id of ["owner", "other", "admin", "member", "colleague"])
    repository.state.users.push({
      id,
      name: id,
      email: `${id}@example.com`,
      passwordHash: null,
      sessionVersion: 0,
      emailVerified: null,
    });
  return repository;
}
