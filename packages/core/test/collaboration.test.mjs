import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CollaborationService,
  OrganizationService,
  OperationsService,
} from "../dist/index.js";
import { fixture } from "./memory-repository.mjs";

test("malformed portal tokens are rejected before opening a database transaction", async () => {
  const service = new CollaborationService({
    transaction: async () => {
      throw new Error("Database must not be accessed");
    },
  });
  for (const operation of [
    service.portalSnapshot("invalid"),
    service.portalDownload("invalid", "file"),
    service.review("invalid", { id: "file", status: "APPROVED" }),
  ])
    await assert.rejects(operation, (error) => error.code === "NOT_FOUND");
});

async function setup() {
  const repository = await fixture(),
    agencies = new OrganizationService(repository),
    ops = new OperationsService(repository),
    service = new CollaborationService(repository),
    actor = { userId: "owner" };
  const { organization } = await agencies.create(actor, {
      name: "Creative Studio",
    }),
    org = organization.id;
  await repository.transaction((tx) =>
    tx.insertMembership({
      userId: "member",
      organizationId: org,
      role: "MEMBER",
    }),
  );
  const client = await ops.saveClient(actor, org, {
    name: "Client One",
    notes: "Internal private notes",
  });
  const otherClient = await ops.saveClient(actor, org, { name: "Client Two" });
  const project = await ops.saveProject(actor, org, {
    name: "Client Launch",
    clientId: client.id,
    budget: "5000",
    description: "Internal strategy",
  });
  const otherProject = await ops.saveProject(actor, org, {
    name: "Other Launch",
    clientId: otherClient.id,
  });
  const input = {
    title: "Brand deliverable",
    projectId: project.id,
    originalName: "design.pdf",
    storageKey: randomUUID(),
    sha256: "a".repeat(64),
    contentType: "application/pdf",
    size: 100,
  };
  return {
    repository,
    ops,
    service,
    actor,
    org,
    client,
    otherClient,
    project,
    otherProject,
    input,
  };
}

test("client portal hides private data and unpublished or unrelated files", async () => {
  const { service, actor, org, client, input, otherProject } = await setup();
  const file = await service.addFile(actor, org, input);
  const other = await service.addFile(actor, org, {
    ...input,
    storageKey: randomUUID(),
    projectId: otherProject.id,
  });
  await service.setPublished(actor, org, other.id, true);
  const grant = await service.issuePortal(actor, org, client.id);
  assert.equal((await service.portalSnapshot(grant.token)).files.length, 0);
  await service.setPublished(actor, org, file.id, true);
  const snapshot = await service.portalSnapshot(grant.token);
  assert.equal(snapshot.projects.length, 1);
  assert.equal(snapshot.files.length, 1);
  for (const forbidden of [
    "storageKey",
    "sha256",
    "Internal private notes",
    "Internal strategy",
    "budgetCents",
    "tokenHash",
  ])
    assert.equal(JSON.stringify(snapshot).includes(forbidden), false);
  await assert.rejects(
    service.portalDownload(grant.token, other.id),
    (error) => error.code === "NOT_FOUND",
  );
  await service.review(grant.token, {
    id: file.id,
    status: "APPROVED",
    note: "Looks good",
  });
  assert.equal(
    (await service.portalSnapshot(grant.token)).files[0].reviewStatus,
    "APPROVED",
  );
  await service.setPublished(actor, org, file.id, false);
  await assert.rejects(
    service.portalDownload(grant.token, file.id),
    (error) => error.code === "NOT_FOUND",
  );
  await assert.rejects(
    service.review(grant.token, { id: file.id, status: "APPROVED" }),
    (error) => error.code === "NOT_FOUND",
  );
});

test("portal replacement, revocation and exclusive expiry invalidate every read and write", async () => {
  const { service, repository, actor, org, client, input } = await setup();
  const file = await service.addFile(actor, org, input);
  await service.setPublished(actor, org, file.id, true);
  const now = new Date("2026-10-23T12:00:00Z"),
    first = await service.issuePortal(actor, org, client.id, now),
    second = await service.issuePortal(actor, org, client.id, now);
  assert.notEqual(repository.state.portalAccess[0].tokenHash, second.token);
  assert.equal(
    (await service.snapshot(actor, org)).portalAccess[0].tokenHash,
    undefined,
  );
  await assert.rejects(service.portalSnapshot(first.token, now));
  await assert.rejects(service.portalSnapshot(second.token, second.expiresAt));
  const access = repository.state.portalAccess[0];
  await service.revokePortal(actor, org, access.id, now);
  await assert.rejects(service.portalSnapshot(second.token, now));
  await assert.rejects(service.portalDownload(second.token, file.id, now));
  await assert.rejects(
    service.review(second.token, { id: file.id, status: "APPROVED" }, now),
  );
});

test("collaboration requires current membership and rejects forged tenant relations", async () => {
  const { service, ops, repository, actor, org, client, project, input } =
    await setup();
  await assert.rejects(
    service.addFile({ userId: "member" }, org, input),
    (error) => error.code === "FORBIDDEN",
  );
  await assert.rejects(
    service.issuePortal({ userId: "member" }, org, client.id),
    (error) => error.code === "FORBIDDEN",
  );
  await assert.rejects(
    service.addContact(actor, org, { clientId: "foreign", name: "Contact" }),
  );
  const task = await ops.saveTask(actor, org, {
    title: "Review design",
    projectId: project.id,
  });
  const comment = await service.addComment(actor, org, {
    taskId: task.id,
    body: "Internal discussion",
  });
  await assert.rejects(
    service.removeComment({ userId: "member" }, org, comment.id),
    (error) => error.code === "FORBIDDEN",
  );
  await assert.rejects(
    service.addComment(actor, org, { taskId: "foreign", body: "Invalid" }),
  );
  await repository.transaction((tx) => tx.removeMember("member", org));
  await assert.rejects(
    service.addComment({ userId: "member" }, org, {
      taskId: task.id,
      body: "No longer a member",
    }),
  );
});

test("moving a project to another client withdraws files and clears old review feedback", async () => {
  const { service, ops, actor, org, client, otherClient, project, input } =
    await setup();
  const file = await service.addFile(actor, org, input);
  await service.setPublished(actor, org, file.id, true);
  const oldGrant = await service.issuePortal(actor, org, client.id),
    newGrant = await service.issuePortal(actor, org, otherClient.id);
  await service.review(oldGrant.token, {
    id: file.id,
    status: "APPROVED",
    note: "Private client feedback",
  });
  await ops.saveProject(
    actor,
    org,
    { name: project.name, clientId: otherClient.id },
    project.id,
  );
  assert.equal((await service.portalSnapshot(oldGrant.token)).files.length, 0);
  assert.equal((await service.portalSnapshot(newGrant.token)).files.length, 0);
  await service.setPublished(actor, org, file.id, true);
  const revealed = (await service.portalSnapshot(newGrant.token)).files[0];
  assert.equal(revealed.reviewStatus, "PENDING");
  assert.equal(revealed.reviewNote, "");
});
