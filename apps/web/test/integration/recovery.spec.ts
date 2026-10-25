import { randomUUID } from "node:crypto";
import { requestPasswordReset, requestEmailVerification } from "@nexus/auth";
import { database, repository } from "@nexus/database";
import { expect, test } from "@playwright/test";

test.afterAll(async () => {
  await database.$disconnect();
});

test("password reset changes credentials, consumes the link, and revokes the old browser session", async ({
  page,
  browser,
}) => {
  const email = `recovery-${randomUUID()}@example.com`;
  const oldPassword = "My original long passphrase 2026!";
  const newPassword = "My new and different passphrase 2026!";
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Recovery User");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(oldPassword);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
  let token = "";
  // Capture delivery in the test process; never send test email to a real provider.
  await requestPasswordReset(repository, email, async (_recipient, value) => {
    token = value;
  });
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const fresh = await browser.newContext({
    baseURL: process.env.NEXUS_TEST_BASE_URL ?? "http://127.0.0.1:3000",
  });
  try {
    const resetPage = await fresh.newPage();
    await resetPage.goto(`/reset-password?token=${token}`);
    await resetPage.getByLabel("New password").fill(newPassword);
    await resetPage.getByRole("button", { name: "Update password" }).click();
    await expect(resetPage.getByRole("status")).toContainText(
      "Your password has been updated",
    );
    await page.reload();
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(oldPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      /couldn['\u2019]t sign you in/,
    );
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    await resetPage.goto(`/reset-password?token=${token}`);
    await resetPage
      .getByLabel("New password")
      .fill("Another attempt at a long passphrase!");
    await resetPage.getByRole("button", { name: "Update password" }).click();
    await expect(resetPage.locator("form").getByRole("alert")).toContainText(
      "invalid or expired",
    );
    const account = await database.user.findUniqueOrThrow({ where: { email } });
    let verificationToken = "";
    await requestEmailVerification(
      repository,
      account.id,
      async (_recipient, value) => {
        verificationToken = value;
      },
    );
    await page.goto(`/verify-email?token=${verificationToken}`);
    await page.getByRole("button", { name: "Confirm email address" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    expect(
      (await database.user.findUniqueOrThrow({ where: { email } }))
        .emailVerified,
    ).not.toBeNull();
  } finally {
    await fresh.close();
  }
});
