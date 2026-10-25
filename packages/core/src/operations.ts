import {
  DomainError,
  parseClient,
  parseIdentifier,
  parseName,
  parseOptionalId,
  parseProject,
  parseTask,
} from "@nexus/contracts";
import type { OrganizationRole } from "@nexus/shared";
import { requireMembership } from "./index.js";
import type { Actor, RepositoryTransaction } from "./repository.js";

export interface ClientRecord {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  company: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  clientId: string | null;
  status: "PLANNED" | "ACTIVE" | "REVIEW" | "COMPLETED" | "ARCHIVED";
  budgetCents: number;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface TaskRecord {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  createdById: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH";
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface AuditRecord {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  action: string;
  entityLabel: string;
  createdAt: Date;
}
export interface NotificationRecord {
  id: string;
  organizationId: string;
  recipientId: string;
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface OperationsTransaction extends RepositoryTransaction {
  listClients(organizationId: string): Promise<ClientRecord[]>;
  findClient(id: string, organizationId: string): Promise<ClientRecord | null>;
  saveClient(
    id: string | null,
    organizationId: string,
    data: ReturnType<typeof parseClient>,
  ): Promise<ClientRecord>;
  deleteClient(id: string, organizationId: string): Promise<void>;
  listProjects(organizationId: string): Promise<ProjectRecord[]>;
  findProject(
    id: string,
    organizationId: string,
  ): Promise<ProjectRecord | null>;
  saveProject(
    id: string | null,
    organizationId: string,
    data: ReturnType<typeof parseProject>,
  ): Promise<ProjectRecord>;
  deleteProject(id: string, organizationId: string): Promise<void>;
  listTasks(organizationId: string): Promise<TaskRecord[]>;
  findTask(id: string, organizationId: string): Promise<TaskRecord | null>;
  saveTask(
    id: string | null,
    organizationId: string,
    createdById: string,
    data: ReturnType<typeof parseTask>,
  ): Promise<TaskRecord>;
  deleteTask(id: string, organizationId: string): Promise<void>;
  writeAudit(data: Omit<AuditRecord, "id" | "createdAt">): Promise<void>;
  listAudit(organizationId: string): Promise<AuditRecord[]>;
  notify(
    data: Pick<
      NotificationRecord,
      "organizationId" | "recipientId" | "title" | "message"
    >,
  ): Promise<void>;
  listNotifications(
    organizationId: string,
    recipientId: string,
  ): Promise<NotificationRecord[]>;
  markNotificationRead(
    id: string,
    organizationId: string,
    recipientId: string,
  ): Promise<void>;
  setMemberRole(
    userId: string,
    organizationId: string,
    role: OrganizationRole,
  ): Promise<void>;
  removeMember(userId: string, organizationId: string): Promise<void>;
  renameOrganization(organizationId: string, name: string): Promise<void>;
  withdrawProjectFiles(
    organizationId: string,
    projectId: string,
  ): Promise<void>;
}

export interface OperationsRepository {
  transaction<T>(
    operation: (transaction: OperationsTransaction) => Promise<T>,
  ): Promise<T>;
}

const managers: readonly OrganizationRole[] = ["OWNER", "ADMIN"];

async function audit(
  tx: OperationsTransaction,
  actor: Actor,
  organizationId: string,
  action: string,
  entityLabel: string,
) {
  const user = actor.userId ? await tx.findUserById(actor.userId) : null;
  if (!user) throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
  await tx.writeAudit({
    organizationId,
    actorId: user.id,
    actorName: user.name ?? user.email,
    action,
    entityLabel,
  });
}

function missing(value: unknown): asserts value {
  if (!value)
    throw new DomainError(
      "NOT_FOUND",
      "This record is unavailable in your workspace.",
    );
}

export class OperationsService {
  constructor(private readonly repository: OperationsRepository) {}

  async snapshot(actor: Actor, organizationId: string) {
    return this.repository.transaction(async (tx) => {
      const membership = await requireMembership(tx, actor, organizationId);
      const organization = await tx.findOrganizationById(organizationId);
      missing(organization);
      const [clients, projects, tasks, members, activity, notifications] =
        await Promise.all([
          tx.listClients(organizationId),
          tx.listProjects(organizationId),
          tx.listTasks(organizationId),
          tx.listMembers(organizationId),
          tx.listAudit(organizationId),
          tx.listNotifications(organizationId, membership.userId),
        ]);
      return {
        organization,
        membership,
        clients,
        projects,
        tasks,
        members,
        activity,
        notifications,
      };
    });
  }

  async saveClient(
    actor: Actor,
    organizationId: string,
    input: unknown,
    recordId?: unknown,
  ) {
    const data = parseClient(input),
      id = parseOptionalId(recordId);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, organizationId, managers);
      if (id) missing(await tx.findClient(id, organizationId));
      const record = await tx.saveClient(id, organizationId, data);
      await audit(
        tx,
        actor,
        organizationId,
        id ? "Updated client" : "Created client",
        record.name,
      );
      return record;
    });
  }

  async saveProject(
    actor: Actor,
    organizationId: string,
    input: unknown,
    recordId?: unknown,
  ) {
    const data = parseProject(input),
      id = parseOptionalId(recordId);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, organizationId, managers);
      const existing = id ? await tx.findProject(id, organizationId) : null;
      if (id) missing(existing);
      if (data.clientId)
        missing(await tx.findClient(data.clientId, organizationId));
      if (existing && existing.clientId !== data.clientId)
        await tx.withdrawProjectFiles(organizationId, existing.id);
      const record = await tx.saveProject(id, organizationId, data);
      await audit(
        tx,
        actor,
        organizationId,
        id ? "Updated project" : "Created project",
        record.name,
      );
      return record;
    });
  }

  async saveTask(
    actor: Actor,
    organizationId: string,
    input: unknown,
    recordId?: unknown,
  ) {
    const data = parseTask(input),
      id = parseOptionalId(recordId);
    return this.repository.transaction(async (tx) => {
      const member = await requireMembership(tx, actor, organizationId);
      const existing = id ? await tx.findTask(id, organizationId) : null;
      if (id) missing(existing);
      if (
        member.role === "MEMBER" &&
        ((existing &&
          existing.assigneeId !== member.userId &&
          existing.createdById !== member.userId) ||
          (data.assigneeId &&
            data.assigneeId !== member.userId &&
            data.assigneeId !== existing?.assigneeId))
      )
        throw new DomainError(
          "FORBIDDEN",
          "Members can edit their own tasks and assign tasks only to themselves.",
        );
      missing(await tx.findProject(data.projectId, organizationId));
      if (data.assigneeId)
        missing(await tx.findMembership(data.assigneeId, organizationId));
      const task = await tx.saveTask(
        id,
        organizationId,
        existing?.createdById ?? member.userId,
        data,
      );
      await audit(
        tx,
        actor,
        organizationId,
        id ? "Updated task" : "Created task",
        task.title,
      );
      if (
        task.assigneeId &&
        task.assigneeId !== member.userId &&
        task.assigneeId !== existing?.assigneeId
      )
        await tx.notify({
          organizationId,
          recipientId: task.assigneeId,
          title: "A task was assigned to you",
          message: task.title,
        });
      return task;
    });
  }

  async deleteRecord(
    actor: Actor,
    organizationId: string,
    kind: "client" | "project" | "task",
    recordId: unknown,
  ) {
    const id = parseIdentifier(recordId);
    return this.repository.transaction(async (tx) => {
      const member = await requireMembership(
        tx,
        actor,
        organizationId,
        kind === "task" ? undefined : managers,
      );
      let label: string;
      if (kind === "client") {
        const client = await tx.findClient(id, organizationId);
        missing(client);
        label = client.name;
        if (
          (await tx.listProjects(organizationId)).some(
            (project) => project.clientId === id,
          )
        )
          throw new DomainError(
            "CONFLICT",
            "Reassign or delete this client's projects first.",
          );
        await tx.deleteClient(id, organizationId);
      } else if (kind === "project") {
        const project = await tx.findProject(id, organizationId);
        missing(project);
        label = project.name;
        await tx.deleteProject(id, organizationId);
      } else {
        const task = await tx.findTask(id, organizationId);
        missing(task);
        label = task.title;
        if (member.role === "MEMBER" && task.createdById !== member.userId)
          throw new DomainError(
            "FORBIDDEN",
            "Only managers or the task's creator can delete this task.",
          );
        await tx.deleteTask(id, organizationId);
      }
      await audit(tx, actor, organizationId, `Deleted ${kind}`, label);
    });
  }

  async setMemberRole(
    actor: Actor,
    organizationId: string,
    targetId: unknown,
    role: unknown,
  ) {
    const userId = parseIdentifier(targetId);
    if (role !== "OWNER" && role !== "ADMIN" && role !== "MEMBER")
      throw new DomainError("VALIDATION", "Choose a valid role.");
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, organizationId, ["OWNER"]);
      const target = await tx.findMembership(userId, organizationId);
      missing(target);
      if (
        target.role === "OWNER" &&
        role !== "OWNER" &&
        (await tx.listMembers(organizationId)).filter(
          (member) => member.role === "OWNER",
        ).length < 2
      )
        throw new DomainError(
          "CONFLICT",
          "An agency must keep at least one owner.",
        );
      await tx.setMemberRole(userId, organizationId, role);
      await audit(
        tx,
        actor,
        organizationId,
        "Changed member role",
        `${userId}: ${role}`,
      );
    });
  }

  async removeMember(actor: Actor, organizationId: string, targetId: unknown) {
    const userId = parseIdentifier(targetId);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, organizationId, ["OWNER"]);
      const target = await tx.findMembership(userId, organizationId);
      missing(target);
      if (
        target.role === "OWNER" &&
        (await tx.listMembers(organizationId)).filter(
          (member) => member.role === "OWNER",
        ).length < 2
      )
        throw new DomainError(
          "CONFLICT",
          "An agency must keep at least one owner.",
        );
      await tx.removeMember(userId, organizationId);
      await audit(tx, actor, organizationId, "Removed member", userId);
    });
  }

  async rename(actor: Actor, organizationId: string, input: unknown) {
    const name = parseName(input);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, organizationId, ["OWNER"]);
      await tx.renameOrganization(organizationId, name);
      await audit(tx, actor, organizationId, "Renamed agency", name);
    });
  }

  async markRead(actor: Actor, organizationId: string, id: unknown) {
    const notificationId = parseIdentifier(id);
    return this.repository.transaction(async (tx) => {
      const member = await requireMembership(tx, actor, organizationId);
      await tx.markNotificationRead(
        notificationId,
        organizationId,
        member.userId,
      );
    });
  }

  async notifications(actor: Actor, organizationId: string) {
    return this.repository.transaction(async (tx) => {
      const member = await requireMembership(tx, actor, organizationId);
      return tx.listNotifications(organizationId, member.userId);
    });
  }
}
