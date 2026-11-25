import { expect, test } from "@playwright/test";

// The server runs with CHAT_MOCK=1: scripted replies, no real model.

test("suggestion chip sends, streams tokens and shows a tool card", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1, name: "What brings you here?" })).toBeVisible();
  await page.getByRole("button", { name: "I'm hiring an AI engineer" }).click();

  // User bubble, then streamed agent text growing over time.
  await expect(page.getByText("I'm hiring an AI engineer", { exact: true })).toBeVisible();
  const agent = page.locator("ol li").nth(1);
  await expect(agent).toContainText("Good fit");
  const partial = (await agent.textContent())?.length ?? 0;
  await expect(page.getByTestId("agent-done")).toHaveCount(1, { timeout: 10_000 });
  expect((await agent.textContent())?.length ?? 0).toBeGreaterThan(partial);

  await expect(page.getByRole("link", { name: "Book 30 min" })).toHaveAttribute("href", /cal\.com/);
});

test("typing + Enter sends; Shift+Enter adds a newline", async ({ page }) => {
  await page.goto("/chat");
  const input = page.getByRole("textbox", { name: "Message Shakil's agent" });
  await input.fill("first line");
  await input.press("Shift+Enter");
  await input.pressSequentially("second");
  await expect(input).toHaveValue("first line\nsecond");
  await input.press("Enter");
  await expect(page.getByTestId("agent-done")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator("ol li").nth(1)).toContainText("not something I know");
});

test("?q= prefills without sending", async ({ page }) => {
  await page.goto("/chat?q=Tell%20me%20how%20the%20Customer%20Support%20Agent%20worked");
  await expect(page.getByRole("textbox")).toHaveValue("Tell me how the Customer Support Agent worked");
  await expect(page.locator("ol li")).toHaveCount(0);
});

test("Stop aborts the stream and New chat resets", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "What's he building right now?" }).click();
  const stop = page.getByRole("button", { name: "Stop" });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByRole("heading", { name: "What brings you here?" })).toBeVisible();
});

test("leave_intro renders a form the visitor submits", async ({ page }) => {
  await page.goto("/chat");
  const input = page.getByRole("textbox");
  await input.fill("Can he follow up with me?");
  await input.press("Enter");
  await expect(page.getByTestId("agent-done")).toHaveCount(1, { timeout: 10_000 });
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Send this to Shakil").check();
  await page.getByRole("button", { name: "Send", exact: true }).first().click();
  await expect(page.getByText("Sent. He reads these himself.")).toBeVisible();
});

test("API rejects cross-origin posts and malformed bodies", async ({ request }) => {
  const bad = await request.post("/api/chat", {
    headers: { origin: "https://evil.example" },
    data: { messages: [{ role: "user", content: "hi" }] },
  });
  expect(bad.status()).toBe(403);
  const malformed = await request.post("/api/chat", {
    headers: { origin: "http://localhost:3100" },
    data: { messages: [{ role: "assistant", content: "hi" }] },
  });
  expect(malformed.status()).toBe(400);
});
