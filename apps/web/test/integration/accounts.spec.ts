import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Nexus Test User");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A long test passphrase 2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
}

test("signup, agencies, tenant access, invitations, switching, and signout", async ({
  page,
  browser,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const colleagueEmail = `colleague-${suffix}@example.com`;
  await signUp(page, `owner-${suffix}@example.com`);
  await page
    .getByLabel("Agency name", { exact: true })
    .fill(`Agency ${suffix}`);
  await page
    .getByRole("button", { name: "Create agency", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+$/);
  const agencyUrl = page.url();
  await expect(
    page.getByRole("heading", { name: `Agency ${suffix}`, exact: true }),
  ).toBeVisible();

  const colleagueContext = await browser.newContext({
    baseURL: process.env.NEXUS_TEST_BASE_URL ?? "http://127.0.0.1:3000",
  });
  const colleague = await colleagueContext.newPage();
  try {
    await signUp(colleague, colleagueEmail);
    await colleague.goto(agencyUrl);
    await expect(
      colleague.getByRole("heading", { name: "Page unavailable" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Agency navigation" })
      .getByRole("link", { name: "team", exact: true })
      .click();
    await page.getByLabel("Email address").fill(colleagueEmail);
    await page.getByLabel("Workspace role").selectOption("MEMBER");
    await page.getByRole("button", { name: "Create invitation link" }).click();
    const invitation = page.getByLabel("Invitation link", { exact: true });
    await expect(invitation).toBeVisible();
    const invitationUrl = await invitation.inputValue();
    await colleague.goto(invitationUrl);
    await colleague
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await expect(colleague).toHaveURL(agencyUrl);
    await expect(
      colleague.getByRole("button", { name: "Create invitation link" }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(colleagueEmail, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: /All workspaces/ }).click();
    await page
      .getByLabel("Agency name", { exact: true })
      .fill(`Second Agency ${suffix}`);
    await page
      .getByRole("button", { name: "Create agency", exact: true })
      .click();
    const targetId = new URL(agencyUrl).pathname.split("/").at(-1)!;
    await page
      .getByRole("combobox", { name: "Workspace", exact: true })
      .selectOption(targetId);
    await page
      .getByRole("button", { name: "Switch workspace", exact: true })
      .click();
    await expect(page).toHaveURL(agencyUrl);

    await colleague.goto(invitationUrl);
    await colleague
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await expect(colleague.locator("form").getByRole("alert")).toContainText(
      "invalid or expired",
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto(agencyUrl);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
  } finally {
    await colleagueContext.close();
  }
});
