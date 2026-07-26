import { test, expect } from "@playwright/test";

/**
 * Smoke test: the dApp loads in demo mode with NO wallet and NO env vars.
 * A first-time visitor should see the pitch, the connect prompt, and correct
 * meta tags — and the page should not throw runtime errors.
 */

test.describe("Demo mode — home", () => {
  test("loads and shows the hero pitch without a wallet", async ({ page }) => {
    await page.goto("/");

    // Brand + hero copy render.
    await expect(page.getByRole("link", { name: "NoxSend" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("32 bytes");
    await expect(page.getByText("Private send for the wallet you already have")).toBeVisible();

    // Without a wallet, the connect prompt is shown (no crash, no forced connect).
    await expect(
      page.getByText("Connect the wallet you already use", { exact: false })
    ).toBeVisible();
  });

  test("has correct SEO / social meta tags", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/NoxSend/);

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toBeTruthy();
    expect(description).toMatch(/encrypted|Nox|private/i);

    // Favicon wired via Next metadata.
    const iconHref = await page
      .locator('link[rel="icon"]')
      .first()
      .getAttribute("href");
    expect(iconHref).toContain("icon.svg");
  });

  test("no uncaught console errors on first paint", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/", { waitUntil: "networkidle" });

    // Ignore benign browser/network noise unrelated to app correctness
    // (wallet extensions absent, favicon, third-party RPC probes, etc.).
    const meaningful = errors.filter(
      (e) =>
        !/favicon/i.test(e) &&
        !/ResizeObserver/i.test(e) &&
        !/net::ERR_/i.test(e) &&
        !/Failed to load resource/i.test(e) &&
        !/ethereum|wallet|injected|MetaMask/i.test(e)
    );
    expect(meaningful).toEqual([]);
  });

  test("secondary routes are reachable without a wallet", async ({ page }) => {
    // Nav is hidden on mobile viewports, so verify the routes by direct load.
    await page.goto("/claim");
    await expect(
      page.getByRole("heading", { name: /Claim a private payment/i })
    ).toBeVisible();

    await page.goto("/verify");
    await expect(page.getByRole("heading", { name: /verify/i })).toBeVisible();
  });
});
