import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.NEXUS_TEST_DOCUMENT ?? "/demo");
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test("overview renders without browser errors", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Good things are taking shape." }),
  ).toBeVisible();
  await expect(page.getByText("$51,000", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A new chapter for Bloom", { exact: true }),
  ).toBeVisible();
});

test("workspace switching updates projects, people, and metrics", async ({
  page,
}) => {
  await page.getByLabel("Active workspace").selectOption("org-form");
  await expect(page.getByText("Room to grow", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A new chapter for Bloom", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("$27,000", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Meet your team" }).click();
  await expect(
    page.getByRole("heading", { name: "Sam Rivera", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Maya Chen", exact: true }),
  ).toHaveCount(0);
});

test("search and status filters compose and show an empty state", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Projects", exact: false })
    .first()
    .click();
  await page.getByLabel("Search workspace").fill("Bloom");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Filter by status").selectOption("Completed");
  await expect(
    page.getByRole("heading", { name: "No projects to show" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByText("A little more wonder", { exact: true }),
  ).toBeVisible();
});

test("creating a project updates only its workspace and resets on refresh", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Project name").fill("Atlas identity");
  await dialog.getByLabel("Client name").fill("Atlas");
  await dialog.getByLabel("Budget (USD)").fill("1250.99");
  await dialog.getByLabel("Due date").fill("2026-12-15");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Atlas identity created",
  );
  await expect(page.getByText("Atlas identity", { exact: true })).toBeVisible();
  await page.getByLabel("Active workspace").selectOption("org-form");
  await expect(page.getByText("Atlas identity", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Active workspace").selectOption("org-northstar");
  await expect(page.getByText("Atlas identity", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Atlas identity", { exact: true })).toHaveCount(
    0,
  );
});

test("project dialog supports Escape and restores focus", async ({ page }) => {
  const opener = page.getByRole("button", { name: "New project" });
  await opener.click();
  await expect(page.getByLabel("Project name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("mobile navigation works without overflowing the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Great work starts with people." }),
  ).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
