import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProject,
  filterProjects,
  formatDate,
  formatMoney,
  getWorkspaceData,
  initialProjects,
  teamMembers,
  validateProjectInput,
} from "../src/lib/workspace.ts";

test("workspace metrics include only the selected organization's projects and members", () => {
  const northstar = getWorkspaceData(
    "org-northstar",
    initialProjects,
    teamMembers,
  );
  const form = getWorkspaceData("org-form", initialProjects, teamMembers);
  assert.equal(northstar.projects.length, 4);
  assert.equal(northstar.activeProjects, 3);
  assert.equal(northstar.completedProjects, 1);
  assert.equal(northstar.members.length, 4);
  assert.equal(northstar.budgetCents, 5100000);
  assert.equal(northstar.progress, 77);
  assert.equal(form.projects.length, 2);
  assert.equal(form.members.length, 2);
  assert.equal(form.budgetCents, 2700000);
  assert.ok(
    form.projects.every((project) => project.organizationId === "org-form"),
  );
});

test("an unknown workspace produces empty data and finite zero progress", () => {
  const workspace = getWorkspaceData(
    "not-an-organization",
    initialProjects,
    teamMembers,
  );
  assert.deepEqual(workspace.projects, []);
  assert.deepEqual(workspace.members, []);
  assert.equal(workspace.progress, 0);
  assert.equal(workspace.budgetCents, 0);
});

test("search is case insensitive, trims whitespace, and combines with status", () => {
  const projects = getWorkspaceData(
    "org-northstar",
    initialProjects,
    teamMembers,
  ).projects;
  assert.equal(filterProjects(projects, "  BLOOM  ", "All").length, 1);
  assert.equal(filterProjects(projects, "bloom", "Completed").length, 0);
  assert.equal(filterProjects(projects, "", "Completed").length, 1);
  assert.equal(filterProjects(projects, "there is no match", "All").length, 0);
});

const valid = {
  name: "  New identity  ",
  client: "  Atlas  ",
  budget: "1250.99",
  dueDate: "2026-11-15",
};

test("new projects retain the selected workspace and exact budget cents", () => {
  const project = createProject(valid, "org-form", "new-id");
  assert.equal(project.organizationId, "org-form");
  assert.equal(project.name, "New identity");
  assert.equal(project.client, "Atlas");
  assert.equal(project.budgetCents, 125099);
  assert.equal(project.totalTasks, 0);
  assert.equal(project.status, "In progress");
  const data = getWorkspaceData("org-form", [project], []);
  assert.equal(data.progress, 0);
});

test("project input rejects blank names, invalid amounts, and impossible dates", () => {
  for (const input of [
    { ...valid, name: "  " },
    { ...valid, client: "a" },
    { ...valid, budget: "-1" },
    { ...valid, budget: "1.234" },
    { ...valid, budget: "Infinity" },
    { ...valid, budget: "1e3" },
    { ...valid, budget: "10000000" },
    { ...valid, dueDate: "2026-02-30" },
    { ...valid, dueDate: "wrong" },
  ]) {
    assert.ok(validateProjectInput(input));
    assert.throws(() => createProject(input, "org", "id"));
  }
  assert.throws(() => createProject(valid, "", "id"));
  assert.equal(
    validateProjectInput({ ...valid, budget: "0", dueDate: "2028-02-29" }),
    null,
  );
});

test("money and date formatting preserve cents and the calendar date", () => {
  assert.equal(formatMoney(125099), "$1,250.99");
  assert.equal(formatMoney(0), "$0");
  assert.equal(formatDate("2026-11-15"), "Nov 15");
});
