import { expect, test } from "@playwright/test";

// Served by the second webServer (CHAT_ENABLED=false), see playwright.config.ts.
const BASE = `http://localhost:${Number(process.env.E2E_PORT ?? 3101) + 1}`;

test("CHAT_ENABLED=false renders the kill-switch state: book card and email, no input", async ({ page }) => {
  await page.goto(`${BASE}/chat`);
  await expect(page.getByRole("heading", { level: 1, name: "What brings you here?" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I'm hiring an AI engineer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Book 30 min" })).toHaveAttribute("href", /cal\.com/);
  await expect(page.getByText("shakilwizard@gmail.com", { exact: false })).toBeVisible();
});

test("the API agrees with the page: 503 unavailable", async ({ request }) => {
  const res = await request.post(`${BASE}/api/chat`, {
    headers: { origin: BASE },
    data: { messages: [{ role: "user", content: "hi" }] },
  });
  expect(res.status()).toBe(503);
  expect(await res.text()).toContain('"code":"unavailable"');
});
