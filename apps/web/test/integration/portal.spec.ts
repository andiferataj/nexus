import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("client-to-project-to-deliverable approval and immediate portal revocation", async ({
  page,
  browser,
}) => {
  const origin = process.env.NEXUS_TEST_BASE_URL ?? "http://127.0.0.1:3000";
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Portal Owner");
  await page
    .getByLabel("Email address")
    .fill(`portal-${randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A long portal owner passphrase 2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page
    .getByLabel("Agency name", { exact: true })
    .fill(`Portal Agency ${randomUUID().slice(0, 8)}`);
  await page
    .getByRole("button", { name: "Create agency", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+$/);
  const nav = page.getByRole("navigation", { name: "Agency navigation" }),
    create = page.locator(".sticky-form");
  await nav.getByRole("link", { name: "clients", exact: true }).click();
  await create.getByLabel("Client name").fill("Portal Client");
  await create
    .getByLabel("Notes")
    .fill("These internal notes must stay private");
  await create.getByRole("button", { name: "Create client" }).click();
  await expect(
    page.getByRole("heading", { name: "Portal Client", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "projects", exact: true }).click();
  await create.getByLabel("Project name").fill("Portal Launch");
  await create
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption({ label: "Portal Client" });
  await create.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.getByRole("heading", { name: "Portal Launch", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "files", exact: true }).click();
  await create.getByLabel("Title").fill("Launch handoff");
  await create.getByLabel("File", { exact: true }).setInputFiles({
    name: "handoff.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Approved launch handoff"),
  });
  await create
    .getByRole("button", { name: "Upload file", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Launch handoff", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Share with client for review" })
    .click();
  await expect(page.locator(".record-card .role-badge")).toHaveText("pending");
  await nav.getByRole("link", { name: "portal", exact: true }).click();
  await page
    .getByRole("button", { name: "Create portal link", exact: true })
    .click();
  const link = page.getByLabel("Client portal link", { exact: true });
  await expect(link).toBeVisible();
  const url = await link.inputValue();
  const client = await browser.newContext({ baseURL: origin });
  try {
    const portal = await client.newPage();
    await portal.goto(url);
    await expect(
      portal.getByRole("heading", { name: "Launch handoff", exact: true }),
    ).toBeVisible();
    await expect(
      portal.getByText("These internal notes must stay private"),
    ).toHaveCount(0);
    const download = portal.getByRole("link", {
      name: "Download file",
      exact: true,
    });
    const downloadUrl = await download.getAttribute("href");
    expect(downloadUrl).toBeTruthy();
    const response = await client.request.get(downloadUrl!);
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe("Approved launch handoff");
    expect(response.headers()["content-disposition"]).toContain("attachment");
    await portal.getByText("Review this deliverable", { exact: true }).click();
    await portal
      .getByRole("combobox", { name: "Your decision", exact: true })
      .selectOption("APPROVED");
    await portal.getByLabel("Feedback").fill("Ready to launch.");
    await portal.getByRole("button", { name: "Send feedback" }).click();
    await expect(portal.getByRole("status")).toContainText(
      "feedback has been shared",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Revoke client access", exact: true })
      .click();
    await expect(
      page.getByText("No active portal access", { exact: true }),
    ).toBeVisible();
    expect((await client.request.get(downloadUrl!)).status()).toBe(404);
    await portal.reload();
    await expect(
      portal.getByRole("heading", { name: "Page unavailable" }),
    ).toBeVisible();
  } finally {
    await client.close();
  }
});
