import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("clients, projects, tasks, edits, persistence, activity, and deletion", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Workflow Owner");
  await page.getByLabel("Email address").fill(`workflow-${suffix}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A long workflow passphrase 2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page
    .getByLabel("Agency name", { exact: true })
    .fill(`Workflow ${suffix}`);
  await page
    .getByRole("button", { name: "Create agency", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+$/);
  const nav = page.getByRole("navigation", { name: "Agency navigation" });
  await nav.getByRole("link", { name: "clients", exact: true }).click();
  const create = page.locator(".sticky-form");
  await create.getByLabel("Client name").fill("Atlas Client");
  await create.getByLabel("Email", { exact: true }).fill("atlas@example.com");
  await create.getByLabel("Company").fill("Atlas Design");
  await create.getByRole("button", { name: "Create client" }).click();
  await expect(
    page.getByRole("heading", { name: "Atlas Client", exact: true }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "projects", exact: true }).click();
  await create.getByLabel("Project name").fill("Atlas Launch");
  await create
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption({ label: "Atlas Client" });
  await create.getByLabel("Budget (USD)").fill("2500.99");
  await create
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("ACTIVE");
  await create.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.getByRole("heading", { name: "Atlas Launch", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("$2,500.99", { exact: true })).toBeVisible();

  await nav.getByRole("link", { name: "tasks", exact: true }).click();
  await create.getByLabel("Task title").fill("Launch homepage");
  await create
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "Atlas Launch" });
  await create
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption({ label: "Workflow Owner" });
  await create.getByRole("button", { name: "Create task" }).click();
  const card = page.locator(".record-card").filter({
    has: page.getByRole("heading", { name: "Launch homepage", exact: true }),
  });
  await expect(card).toBeVisible();
  await card.getByText("Edit task", { exact: true }).click();
  await card
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("DONE");
  await card.getByRole("button", { name: "Save task" }).click();
  await expect(card.locator(".task-status")).toHaveText("done");
  await nav.getByRole("link", { name: "activity", exact: true }).click();
  await expect(
    page.getByText("Updated task: Launch homepage", { exact: true }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "projects", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Atlas Launch", exact: true }),
  ).toHaveCount(0);
  await nav.getByRole("link", { name: "tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Launch homepage", exact: true }),
  ).toHaveCount(0);
});
