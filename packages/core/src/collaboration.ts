import { createHash, randomBytes } from "node:crypto";
import {
  DomainError,
  parseEmail,
  parseIdentifier,
  parseName,
  parseObject,
  parseText,
} from "@nexus/contracts";
import { requireMembership } from "./index.js";
import type { Actor } from "./repository.js";
import type { OperationsTransaction } from "./operations.js";

export interface ContactRecord {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  createdAt: Date;
}
export interface CommentRecord {
  id: string;
  organizationId: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}
export type ReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
export interface FileRecord {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  originalName: string;
  storageKey: string;
  contentType: string;
  size: number;
  sha256: string;
  published: boolean;
  reviewStatus: ReviewStatus;
  reviewNote: string;
  reviewedAt: Date | null;
  createdAt: Date;
}
export interface PortalRecord {
  id: string;
  organizationId: string;
  clientId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}
export interface CollaborationTransaction extends OperationsTransaction {
  listContacts(org: string): Promise<ContactRecord[]>;
  saveContact(
    org: string,
    data: Omit<ContactRecord, "id" | "organizationId" | "createdAt">,
  ): Promise<ContactRecord>;
  deleteContact(org: string, id: string): Promise<void>;
  listComments(org: string): Promise<CommentRecord[]>;
  insertComment(
    data: Omit<CommentRecord, "id" | "createdAt">,
  ): Promise<CommentRecord>;
  findComment(org: string, id: string): Promise<CommentRecord | null>;
  deleteComment(org: string, id: string): Promise<void>;
  listFiles(org: string): Promise<FileRecord[]>;
  findFile(org: string, id: string): Promise<FileRecord | null>;
  insertFile(
    data: Omit<
      FileRecord,
      | "id"
      | "published"
      | "reviewStatus"
      | "reviewNote"
      | "reviewedAt"
      | "createdAt"
    >,
  ): Promise<FileRecord>;
  updateFile(
    org: string,
    id: string,
    data: Partial<
      Pick<
        FileRecord,
        "published" | "reviewStatus" | "reviewNote" | "reviewedAt"
      >
    >,
  ): Promise<void>;
  deleteFile(org: string, id: string): Promise<void>;
  listPortalAccess(org: string): Promise<PortalRecord[]>;
  replacePortalAccess(
    data: Pick<
      PortalRecord,
      "organizationId" | "clientId" | "tokenHash" | "expiresAt"
    >,
  ): Promise<PortalRecord>;
  revokePortalAccess(org: string, id: string, now: Date): Promise<void>;
  findPortalAccess(hash: string): Promise<PortalRecord | null>;
}
export interface CollaborationRepository {
  transaction<T>(
    operation: (tx: CollaborationTransaction) => Promise<T>,
  ): Promise<T>;
}

const managers = ["OWNER", "ADMIN"] as const;
const unavailable = () =>
  new DomainError("NOT_FOUND", "This record or access link is unavailable.");
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const fileTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
];
export const maximumFileBytes = 20 * 1024 * 1024;

async function log(
  tx: CollaborationTransaction,
  actor: Actor,
  org: string,
  action: string,
  entityLabel: string,
) {
  const user = actor.userId ? await tx.findUserById(actor.userId) : null;
  if (!user) throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
  await tx.writeAudit({
    organizationId: org,
    actorId: user.id,
    actorName: user.name ?? user.email,
    action,
    entityLabel,
  });
}
async function portal(tx: CollaborationTransaction, token: unknown, now: Date) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw unavailable();
  const grant = await tx.findPortalAccess(digest(token));
  if (!grant || grant.revokedAt || grant.expiresAt <= now) throw unavailable();
  const client = await tx.findClient(grant.clientId, grant.organizationId);
  if (!client) throw unavailable();
  return { grant, client };
}

export class CollaborationService {
  constructor(private readonly repository: CollaborationRepository) {}

  async snapshot(actor: Actor, org: string) {
    return this.repository.transaction(async (tx) => {
      const member = await requireMembership(tx, actor, org);
      const [contacts, comments, files, access] = await Promise.all([
        tx.listContacts(org),
        tx.listComments(org),
        tx.listFiles(org),
        member.role === "MEMBER"
          ? Promise.resolve([])
          : tx.listPortalAccess(org),
      ]);
      return {
        contacts,
        comments,
        files: files.map(
          ({ storageKey: _key, sha256: _hash, ...file }) => file,
        ),
        portalAccess: access.map(({ tokenHash: _hash, ...grant }) => grant),
      };
    });
  }

  async addContact(actor: Actor, org: string, input: unknown) {
    const data = parseObject(input),
      clientId = parseIdentifier(data.clientId),
      name = parseName(data.name);
    const email = data.email ? parseEmail(data.email) : "",
      phone = parseText(data.phone, 60),
      title = parseText(data.title, 120);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org, managers);
      if (!(await tx.findClient(clientId, org))) throw unavailable();
      const record = await tx.saveContact(org, {
        clientId,
        name,
        email,
        phone,
        title,
      });
      await log(tx, actor, org, "Added contact", name);
      return record;
    });
  }
  async removeContact(actor: Actor, org: string, input: unknown) {
    const id = parseIdentifier(input);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org, managers);
      await tx.deleteContact(org, id);
      await log(tx, actor, org, "Removed contact", id);
    });
  }
  async addComment(actor: Actor, org: string, input: unknown) {
    const data = parseObject(input),
      taskId = parseIdentifier(data.taskId),
      body = parseText(data.body, 2000);
    if (!body) throw new DomainError("VALIDATION", "Write a comment first.");
    return this.repository.transaction(async (tx) => {
      const member = await requireMembership(tx, actor, org);
      const task = await tx.findTask(taskId, org),
        user = await tx.findUserById(member.userId);
      if (!task || !user) throw unavailable();
      const record = await tx.insertComment({
        organizationId: org,
        taskId,
        authorId: user.id,
        authorName: user.name ?? user.email,
        body,
      });
      await log(tx, actor, org, "Commented on task", task.title);
      if (task.assigneeId && task.assigneeId !== user.id)
        await tx.notify({
          organizationId: org,
          recipientId: task.assigneeId,
          title: "New comment on your task",
          message: task.title,
        });
      return record;
    });
  }
  async removeComment(actor: Actor, org: string, input: unknown) {
    const id = parseIdentifier(input);
    return this.repository.transaction(async (tx) => {
      const member = await requireMembership(tx, actor, org),
        comment = await tx.findComment(org, id);
      if (!comment) throw unavailable();
      if (member.role === "MEMBER" && comment.authorId !== member.userId)
        throw new DomainError(
          "FORBIDDEN",
          "You can remove only your own comments.",
        );
      await tx.deleteComment(org, id);
      await log(tx, actor, org, "Removed comment", comment.taskId);
    });
  }
  async addFile(actor: Actor, org: string, input: unknown) {
    const data = parseObject(input),
      projectId = parseIdentifier(data.projectId),
      title = parseName(data.title),
      originalName = parseText(data.originalName, 240);
    if (
      !originalName ||
      typeof data.storageKey !== "string" ||
      !/^[a-f0-9-]{36}$/.test(data.storageKey) ||
      typeof data.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(data.sha256) ||
      typeof data.contentType !== "string" ||
      !fileTypes.includes(data.contentType) ||
      typeof data.size !== "number" ||
      !Number.isSafeInteger(data.size) ||
      data.size < 1 ||
      data.size > maximumFileBytes
    )
      throw new DomainError(
        "VALIDATION",
        "Choose a supported file up to 20 MB.",
      );
    const { storageKey, sha256, contentType, size } = data;
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org, managers);
      if (!(await tx.findProject(projectId, org))) throw unavailable();
      const file = await tx.insertFile({
        organizationId: org,
        projectId,
        title,
        originalName,
        storageKey,
        sha256,
        contentType,
        size,
      });
      await log(tx, actor, org, "Uploaded file", title);
      return file;
    });
  }
  async setPublished(
    actor: Actor,
    org: string,
    input: unknown,
    published: boolean,
  ) {
    const id = parseIdentifier(input);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org, managers);
      const file = await tx.findFile(org, id);
      if (!file) throw unavailable();
      const project = await tx.findProject(file.projectId, org);
      if (published && !project?.clientId)
        throw new DomainError(
          "VALIDATION",
          "Assign a client to the project before sharing a deliverable.",
        );
      await tx.updateFile(org, id, {
        published,
        ...(published && !file.published
          ? { reviewStatus: "PENDING", reviewNote: "", reviewedAt: null }
          : {}),
      });
      await log(
        tx,
        actor,
        org,
        published ? "Shared deliverable" : "Withdrew deliverable",
        file.title,
      );
    });
  }
  async removeFile(actor: Actor, org: string, input: unknown) {
    const id = parseIdentifier(input);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org, managers);
      const file = await tx.findFile(org, id);
      if (!file) throw unavailable();
      await tx.deleteFile(org, id);
      await log(tx, actor, org, "Deleted file", file.title);
      return file.storageKey;
    });
  }
  async download(actor: Actor, org: string, input: unknown) {
    const id = parseIdentifier(input);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org);
      const file = await tx.findFile(org, id);
      if (!file) throw unavailable();
      return file;
    });
  }
  async issuePortal(
    actor: Actor,
    org: string,
    input: unknown,
    now = new Date(),
  ) {
    const clientId = parseIdentifier(input),
      token = randomBytes(32).toString("hex");
    const access = await this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org, managers);
      const client = await tx.findClient(clientId, org);
      if (!client) throw unavailable();
      const grant = await tx.replacePortalAccess({
        organizationId: org,
        clientId,
        tokenHash: digest(token),
        expiresAt: new Date(now.getTime() + 90 * 86400000),
      });
      await log(tx, actor, org, "Issued client portal access", client.name);
      return { expiresAt: grant.expiresAt };
    });
    return { token, ...access };
  }
  async revokePortal(
    actor: Actor,
    org: string,
    input: unknown,
    now = new Date(),
  ) {
    const id = parseIdentifier(input);
    return this.repository.transaction(async (tx) => {
      await requireMembership(tx, actor, org, managers);
      await tx.revokePortalAccess(org, id, now);
      await log(tx, actor, org, "Revoked portal access", id);
    });
  }
  async portalSnapshot(token: unknown, now = new Date()) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw unavailable();
    return this.repository.transaction(async (tx) => {
      const { grant, client } = await portal(tx, token, now);
      const organization = await tx.findOrganizationById(grant.organizationId);
      const projects = (await tx.listProjects(grant.organizationId)).filter(
        (project) => project.clientId === client.id,
      );
      const ids = new Set(projects.map((project) => project.id));
      const files = (await tx.listFiles(grant.organizationId)).filter(
        (file) => file.published && ids.has(file.projectId),
      );
      return {
        agencyName: organization?.name ?? "Your agency",
        clientName: client.name,
        expiresAt: grant.expiresAt,
        projects: projects.map(({ id, name, status, dueDate }) => ({
          id,
          name,
          status,
          dueDate,
        })),
        files: files.map(
          ({
            id,
            projectId,
            title,
            originalName,
            contentType,
            size,
            reviewStatus,
            reviewNote,
            reviewedAt,
            createdAt,
          }) => ({
            id,
            projectId,
            title,
            originalName,
            contentType,
            size,
            reviewStatus,
            reviewNote,
            reviewedAt,
            createdAt,
          }),
        ),
      };
    });
  }
  async portalDownload(token: unknown, input: unknown, now = new Date()) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw unavailable();
    const id = parseIdentifier(input);
    return this.repository.transaction(async (tx) => {
      const { grant } = await portal(tx, token, now),
        file = await tx.findFile(grant.organizationId, id);
      const project = file
        ? await tx.findProject(file.projectId, grant.organizationId)
        : null;
      if (!file?.published || project?.clientId !== grant.clientId)
        throw unavailable();
      return file;
    });
  }
  async review(token: unknown, input: unknown, now = new Date()) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw unavailable();
    const data = parseObject(input),
      id = parseIdentifier(data.id),
      note = parseText(data.note, 2000);
    if (data.status !== "APPROVED" && data.status !== "CHANGES_REQUESTED")
      throw new DomainError("VALIDATION", "Choose approve or request changes.");
    const status = data.status;
    return this.repository.transaction(async (tx) => {
      const { grant, client } = await portal(tx, token, now),
        file = await tx.findFile(grant.organizationId, id);
      const project = file
        ? await tx.findProject(file.projectId, grant.organizationId)
        : null;
      if (!file?.published || project?.clientId !== client.id)
        throw unavailable();
      if (file.reviewStatus === status && file.reviewNote === note) return;
      const key = digest(`portal-review:${grant.id}`);
      if (!(await tx.consumeAuthAttempt(key, now, 60000, 30)))
        throw new DomainError(
          "VALIDATION",
          "Too many updates. Try again in a minute.",
        );
      await tx.updateFile(grant.organizationId, id, {
        reviewStatus: status,
        reviewNote: note,
        reviewedAt: now,
      });
      await tx.writeAudit({
        organizationId: grant.organizationId,
        actorId: `portal:${client.id}`,
        actorName: client.name,
        action:
          status === "APPROVED" ? "Approved deliverable" : "Requested changes",
        entityLabel: file.title,
      });
      for (const member of await tx.listMembers(grant.organizationId))
        if (member.role !== "MEMBER")
          await tx.notify({
            organizationId: grant.organizationId,
            recipientId: member.userId,
            title:
              status === "APPROVED"
                ? "Client approved a deliverable"
                : "Client requested changes",
            message: `${client.name}: ${file.title}`,
          });
    });
  }
}
