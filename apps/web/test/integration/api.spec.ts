import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("REST resources enforce sessions, origin checks, and tenant membership", async ({
  page,
  browser,
}) => {
  const origin = process.env.NEXUS_TEST_BASE_URL ?? "http://127.0.0.1:3000";
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("API Owner");
  await page
    .getByLabel("Email address")
    .fill(`api-${randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("My API test passphrase 2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
  const create = await page.request.post("/api/v1/workspaces", {
    headers: { Origin: origin },
    data: { name: `API ${randomUUID().slice(0, 8)}` },
  });
  expect(create.status()).toBe(201);
  const org = (await create.json()).data.id as string;
  const target = `/api/v1/workspaces/${org}/clients`;
  const blocked = await page.request.post(target, {
    headers: { Origin: "https://attacker.example" },
    data: { name: "Forged request" },
  });
  expect(blocked.status()).toBe(404);
  const saved = await page.request.post(target, {
    headers: { Origin: origin },
    data: { name: "API Client", email: "api@example.com" },
  });
  expect(saved.status()).toBe(201);
  const id = (await saved.json()).data.id as string;
  expect(
    (await (await page.request.get(`${target}/${id}`)).json()).data.name,
  ).toBe("API Client");
  const anonymous = await browser.newContext({ baseURL: origin });
  try {
    expect((await anonymous.request.get(target)).status()).toBe(401);
  } finally {
    await anonymous.close();
  }
  const deleted = await page.request.delete(`${target}/${id}`, {
    headers: { Origin: origin },
    data: {},
  });
  expect(deleted.status()).toBe(204);
  expect((await page.request.get(`${target}/${id}`)).status()).toBe(404);
});
