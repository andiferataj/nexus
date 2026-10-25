import assert from "node:assert/strict";
import { test } from "node:test";
import { OrganizationService, hashInvitationToken } from "../dist/index.js";
import { fixture } from "./memory-repository.mjs";

const actor = (userId) => ({ userId });
const rejectsCode = (promise, code) =>
  assert.rejects(promise, (error) => error.code === code);

async function setup() {
  const repository = await fixture();
  let time = new Date("2026-10-22T12:00:00Z");
  const service = new OrganizationService(repository, () => time);
  const { organization } = await service.create(actor("owner"), {
    name: "Northstar Studio",
  });
  await repository.transaction(async (tx) => {
    await tx.insertMembership({
      userId: "admin",
      organizationId: organization.id,
      role: "ADMIN",
    });
    await tx.insertMembership({
      userId: "member",
      organizationId: organization.id,
      role: "MEMBER",
    });
  });
  return {
    repository,
    service,
    organization,
    setTime: (value) => {
      time = value;
    },
  };
}

test("agency creation assigns ownership and rolls back if membership creation fails", async () => {
  const repository = await fixture();
  const service = new OrganizationService(repository);
  repository.failMembership = true;
  await assert.rejects(
    service.create(actor("owner"), { name: "First Agency" }),
  );
  assert.equal(repository.state.organizations.length, 0);
  repository.failMembership = false;
  const result = await service.create(actor("owner"), { name: "First Agency" });
  assert.equal(result.membership.role, "OWNER");
  assert.equal(result.membership.organizationId, result.organization.id);
});

test("anonymous and deleted users cannot create agencies", async () => {
  const { service } = await setup();
  await rejectsCode(
    service.create(actor(null), { name: "Another Agency" }),
    "UNAUTHENTICATED",
  );
  await rejectsCode(
    service.create(actor("not-a-user"), { name: "Another Agency" }),
    "UNAUTHENTICATED",
  );
});

test("organization listings and access follow current membership, not client-selected IDs", async () => {
  const { service, organization, repository } = await setup();
  const other = await service.create(actor("other"), { name: "Other Agency" });
  assert.equal((await service.list(actor("owner"))).length, 1);
  await rejectsCode(
    service.access(actor("owner"), other.organization.id),
    "FORBIDDEN",
  );
  await rejectsCode(
    service.access(actor("other"), organization.id),
    "FORBIDDEN",
  );
  await rejectsCode(
    service.access(actor(null), organization.id),
    "UNAUTHENTICATED",
  );
  repository.state.memberships = repository.state.memberships.filter(
    (membership) => membership.userId !== "member",
  );
  await rejectsCode(
    service.access(actor("member"), organization.id),
    "FORBIDDEN",
  );
});

test("concurrent organization creation cannot reserve the same URL twice", async () => {
  const repository = await fixture();
  const service = new OrganizationService(repository);
  const results = await Promise.allSettled([
    service.create(actor("owner"), { name: "Same Agency" }),
    service.create(actor("other"), { name: "Same Agency" }),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(repository.state.organizations.length, 1);
});

test("team listings require membership and never return credential material", async () => {
  const { service, organization } = await setup();
  const members = await service.members(actor("member"), organization.id);
  assert.equal(members.length, 3);
  assert.ok(members.every((member) => !("passwordHash" in member)));
  await rejectsCode(
    service.members(actor("other"), organization.id),
    "FORBIDDEN",
  );
});

test("members cannot invite and admins cannot grant admin or owner access", async () => {
  const { service, organization } = await setup();
  const input = { email: "colleague@example.com", role: "MEMBER" };
  await rejectsCode(
    service.invite(actor("member"), organization.id, input),
    "FORBIDDEN",
  );
  await rejectsCode(
    service.invite(actor("other"), organization.id, input),
    "FORBIDDEN",
  );
  await rejectsCode(
    service.invite(actor("admin"), organization.id, {
      ...input,
      role: "ADMIN",
    }),
    "FORBIDDEN",
  );
  await rejectsCode(
    service.invite(actor("owner"), organization.id, {
      ...input,
      role: "OWNER",
    }),
    "VALIDATION",
  );
  const invite = await service.invite(actor("admin"), organization.id, input);
  assert.match(invite.token, /^[a-f0-9]{64}$/);
});

test("invitation storage contains only a digest, and acceptance binds the account email", async () => {
  const { service, organization, repository } = await setup();
  const invite = await service.invite(actor("owner"), organization.id, {
    email: "COLLEAGUE@example.com",
    role: "ADMIN",
  });
  assert.equal(
    repository.state.invitations[0].tokenHash,
    hashInvitationToken(invite.token),
  );
  assert.ok(!JSON.stringify(repository.state).includes(invite.token));
  await rejectsCode(
    service.acceptInvitation(actor("other"), invite.token),
    "INVALID_INVITATION",
  );
  const accepted = await service.acceptInvitation(
    actor("colleague"),
    invite.token,
  );
  assert.equal(accepted.organizationId, organization.id);
  assert.equal(accepted.membership.role, "ADMIN");
  assert.equal((await service.list(actor("colleague"))).length, 1);
});

test("expiration is exclusive at the deadline and invalid tokens do not mutate membership", async () => {
  const { service, organization, setTime, repository } = await setup();
  const invite = await service.invite(actor("owner"), organization.id, {
    email: "colleague@example.com",
    role: "MEMBER",
  });
  setTime(invite.expiresAt);
  await rejectsCode(
    service.acceptInvitation(actor("colleague"), invite.token),
    "INVALID_INVITATION",
  );
  for (const token of [null, "", "../organization", "a".repeat(64)])
    await rejectsCode(
      service.acceptInvitation(actor("colleague"), token),
      "INVALID_INVITATION",
    );
  assert.equal(
    repository.state.memberships.filter((item) => item.userId === "colleague")
      .length,
    0,
  );
});

test("concurrent invitation acceptance succeeds once", async () => {
  const { service, organization, repository } = await setup();
  const invite = await service.invite(actor("owner"), organization.id, {
    email: "colleague@example.com",
    role: "MEMBER",
  });
  const results = await Promise.allSettled([
    service.acceptInvitation(actor("colleague"), invite.token),
    service.acceptInvitation(actor("colleague"), invite.token),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    repository.state.memberships.filter((item) => item.userId === "colleague")
      .length,
    1,
  );
});

test("reissuing an invitation invalidates the old link", async () => {
  const { service, organization } = await setup();
  const input = { email: "colleague@example.com", role: "MEMBER" };
  const old = await service.invite(actor("owner"), organization.id, input);
  const current = await service.invite(actor("owner"), organization.id, input);
  await rejectsCode(
    service.acceptInvitation(actor("colleague"), old.token),
    "INVALID_INVITATION",
  );
  await service.acceptInvitation(actor("colleague"), current.token);
  await rejectsCode(
    service.invite(actor("owner"), organization.id, input),
    "CONFLICT",
  );
});

test("removing or demoting an inviter invalidates their outstanding invitations", async () => {
  const { service, organization, repository } = await setup();
  const invite = await service.invite(actor("admin"), organization.id, {
    email: "colleague@example.com",
    role: "MEMBER",
  });
  repository.state.memberships.find((item) => item.userId === "admin").role =
    "MEMBER";
  await rejectsCode(
    service.acceptInvitation(actor("colleague"), invite.token),
    "INVALID_INVITATION",
  );
});

test("acceptance preserves stronger existing membership and rolls back consumption on failure", async () => {
  const { service, organization, repository } = await setup();
  const invite = await service.invite(actor("owner"), organization.id, {
    email: "colleague@example.com",
    role: "MEMBER",
  });
  repository.failMembership = true;
  await assert.rejects(
    service.acceptInvitation(actor("colleague"), invite.token),
  );
  assert.equal(repository.state.invitations[0].acceptedAt, null);
  repository.failMembership = false;
  await repository.transaction((tx) =>
    tx.insertMembership({
      userId: "colleague",
      organizationId: organization.id,
      role: "ADMIN",
    }),
  );
  const result = await service.acceptInvitation(
    actor("colleague"),
    invite.token,
  );
  assert.equal(result.membership.role, "ADMIN");
});
