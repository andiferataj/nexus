import assert from "node:assert/strict";
import { test } from "node:test";
import { OrganizationService, OperationsService } from "../dist/index.js";
import { fixture } from "./memory-repository.mjs";

test("a task creator can preserve an existing colleague assignment after losing management access", async () => {
  const { repository, service, org, project } = await setup();
  const task = await repository.transaction((tx) =>
    tx.saveTask(null, org, "member", {
      title: "Delegated before role change",
      projectId: project.id,
      description: "",
      assigneeId: "owner",
      status: "TODO",
      priority: "NORMAL",
      dueDate: null,
    }),
  );
  const result = await service.saveTask(
    { userId: "member" },
    org,
    { title: "Updated brief", projectId: project.id, assigneeId: "owner" },
    task.id,
  );
  assert.equal(result.assigneeId, "owner");
  await assert.rejects(
    service.saveTask(
      { userId: "member" },
      org,
      { title: "New delegation", projectId: project.id, assigneeId: "other" },
      task.id,
    ),
    (error) => error.code === "FORBIDDEN",
  );
});

async function setup() {
  const repository = await fixture(),
    organizations = new OrganizationService(repository),
    service = new OperationsService(repository);
  const { organization } = await organizations.create(
    { userId: "owner" },
    { name: "Product Agency" },
  );
  const { organization: other } = await organizations.create(
    { userId: "other" },
    { name: "Other Agency" },
  );
  await repository.transaction((tx) =>
    tx.insertMembership({
      userId: "member",
      organizationId: organization.id,
      role: "MEMBER",
    }),
  );
  const actor = { userId: "owner" },
    org = organization.id;
  const client = await service.saveClient(actor, org, {
    name: "Atlas Client",
    email: "ATLAS@example.com",
  });
  const project = await service.saveProject(actor, org, {
    name: "Brand Launch",
    clientId: client.id,
    budget: "1250.99",
    status: "ACTIVE",
  });
  return { repository, service, actor, org, other: other.id, client, project };
}

test("persistent operations create, edit, and delete scoped client/project/task records", async () => {
  const { service, actor, org, client, project } = await setup();
  assert.equal(project.budgetCents, 125099);
  const task = await service.saveTask(actor, org, {
    title: "Design homepage",
    projectId: project.id,
    assigneeId: "member",
  });
  await service.saveTask(
    actor,
    org,
    {
      title: "Design homepage",
      projectId: project.id,
      assigneeId: "member",
      status: "DONE",
    },
    task.id,
  );
  const result = await service.snapshot(actor, org);
  assert.equal(result.tasks[0].status, "DONE");
  assert.equal(result.clients[0].email, "atlas@example.com");
  assert.equal(result.activity.length, 4);
  await assert.rejects(
    service.deleteRecord(actor, org, "client", client.id),
    (error) => error.code === "CONFLICT",
  );
  await service.deleteRecord(actor, org, "project", project.id);
  assert.equal((await service.snapshot(actor, org)).tasks.length, 0);
  await service.deleteRecord(actor, org, "client", client.id);
  assert.equal((await service.snapshot(actor, org)).clients.length, 0);
});

test("forged record and foreign-key IDs cannot cross organization boundaries", async () => {
  const { service, actor, org, other, client, project } = await setup();
  await assert.rejects(
    service.snapshot({ userId: "other" }, org),
    (error) => error.code === "FORBIDDEN",
  );
  await assert.rejects(
    service.saveProject({ userId: "other" }, other, {
      name: "Stolen client",
      clientId: client.id,
    }),
    (error) => error.code === "NOT_FOUND",
  );
  await assert.rejects(
    service.saveTask({ userId: "other" }, other, {
      title: "Stolen task",
      projectId: project.id,
    }),
    (error) => error.code === "NOT_FOUND",
  );
  await assert.rejects(
    service.deleteRecord(actor, org, "project", "foreign-id"),
    (error) => error.code === "NOT_FOUND",
  );
  await assert.rejects(
    service.saveTask(actor, org, {
      title: "Invalid assignee",
      projectId: project.id,
      assigneeId: "other",
    }),
    (error) => error.code === "NOT_FOUND",
  );
});

test("members cannot manage clients/projects or assign tasks to other people", async () => {
  const { service, org, project } = await setup();
  const member = { userId: "member" };
  await assert.rejects(
    service.saveClient(member, org, { name: "Forbidden" }),
    (error) => error.code === "FORBIDDEN",
  );
  await assert.rejects(
    service.saveProject(member, org, { name: "Forbidden" }),
    (error) => error.code === "FORBIDDEN",
  );
  await assert.rejects(
    service.saveTask(member, org, {
      title: "Forbidden assignment",
      projectId: project.id,
      assigneeId: "owner",
    }),
    (error) => error.code === "FORBIDDEN",
  );
  const task = await service.saveTask(member, org, {
    title: "My task",
    projectId: project.id,
    assigneeId: "member",
  });
  await service.saveTask(
    member,
    org,
    {
      title: "My task",
      projectId: project.id,
      status: "DONE",
      assigneeId: "member",
    },
    task.id,
  );
});

test("task notifications are personal and repeated saves do not send duplicate assignments", async () => {
  const { service, actor, org, project } = await setup();
  const input = {
    title: "Review launch",
    projectId: project.id,
    assigneeId: "member",
  };
  const task = await service.saveTask(actor, org, input);
  await service.saveTask(actor, org, input, task.id);
  const owner = await service.snapshot(actor, org),
    member = await service.snapshot({ userId: "member" }, org);
  assert.equal(owner.notifications.length, 0);
  assert.equal(member.notifications.length, 1);
  await service.markRead(actor, org, member.notifications[0].id);
  assert.equal(
    (await service.snapshot({ userId: "member" }, org)).notifications[0].readAt,
    null,
  );
  await service.markRead({ userId: "member" }, org, member.notifications[0].id);
  assert.ok(
    (await service.snapshot({ userId: "member" }, org)).notifications[0].readAt,
  );
});

test("last-owner protection survives concurrent demotion requests", async () => {
  const { service, repository, actor, org } = await setup();
  await assert.rejects(
    service.setMemberRole(actor, org, "owner", "MEMBER"),
    (error) => error.code === "CONFLICT",
  );
  await service.setMemberRole(actor, org, "member", "OWNER");
  const results = await Promise.allSettled([
    service.setMemberRole(actor, org, "owner", "MEMBER"),
    service.setMemberRole({ userId: "member" }, org, "member", "MEMBER"),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    repository.state.memberships.filter(
      (item) => item.organizationId === org && item.role === "OWNER",
    ).length,
    1,
  );
});

test("removing a member unassigns tasks and immediately removes access", async () => {
  const { service, actor, org, project } = await setup();
  await service.saveTask(actor, org, {
    title: "Assigned task",
    projectId: project.id,
    assigneeId: "member",
  });
  await service.removeMember(actor, org, "member");
  assert.equal((await service.snapshot(actor, org)).tasks[0].assigneeId, null);
  await assert.rejects(
    service.snapshot({ userId: "member" }, org),
    (error) => error.code === "FORBIDDEN",
  );
});
