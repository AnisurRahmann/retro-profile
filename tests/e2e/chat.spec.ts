import { expect, test } from "@playwright/test";

// The server runs with CHAT_MOCK=1: scripted replies, no real model.

test("suggestion chip sends, streams tokens and shows a tool card", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1, name: "What brings you here?" })).toBeVisible();
  // Record every length the agent reply passes through, so streaming is proven regardless of timing.
  await page.evaluate(() => {
    const w = window as unknown as { __lens: number[] };
    w.__lens = [];
    new MutationObserver(() => {
      const reply = document.querySelectorAll("ol li")[1];
      const n = reply?.textContent?.length ?? 0;
      if (n && n !== w.__lens.at(-1)) w.__lens.push(n);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByRole("button", { name: "I'm hiring an AI engineer" }).click();

  await expect(page.getByText("I'm hiring an AI engineer", { exact: true })).toBeVisible();
  await expect(page.getByTestId("agent-done")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator("ol li").nth(1)).toContainText("Good fit");
  const lens = await page.evaluate(() => (window as unknown as { __lens: number[] }).__lens);
  expect(lens.length).toBeGreaterThanOrEqual(3); // at least two partial states before the final text

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
  // The docked composer moves while tokens stream, so "wait until stable" can outlast the stream.
  await stop.dispatchEvent("click");
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

test("API rejects cross-origin posts and malformed bodies", async ({ request, baseURL }) => {
  const bad = await request.post("/api/chat", {
    headers: { origin: "https://evil.example" },
    data: { messages: [{ role: "user", content: "hi" }] },
  });
  expect(bad.status()).toBe(403);
  const malformed = await request.post("/api/chat", {
    headers: { origin: baseURL! },
    data: { messages: [{ role: "assistant", content: "hi" }] },
  });
  expect(malformed.status()).toBe(400);
});

test("an unavailable reply shows the kill-switch state in place, with a next action", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 503, contentType: "application/x-ndjson", body: '{"type":"error","code":"unavailable"}\n' }),
  );
  await page.goto("/chat");
  await page.getByRole("button", { name: "Let's book a call" }).click();
  const reply = page.locator('[data-error="unavailable"]');
  await expect(reply).toContainText("resting right now");
  await expect(reply.getByRole("link", { name: "Book 30 min" })).toBeVisible();
  await expect(page.getByText("Something broke")).toHaveCount(0);
});

test("a rate-limited reply offers the call instead", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 429, contentType: "application/x-ndjson", body: '{"type":"error","code":"rate_limited"}\n' }),
  );
  await page.goto("/chat");
  await page.getByRole("button", { name: "Let's book a call" }).click();
  await expect(page.locator('[data-error="rate_limited"]')).toContainText("That's a lot of questions");
});
