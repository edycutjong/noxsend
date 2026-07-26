import { test, expect } from "@playwright/test";

/**
 * Core user journey (demo mode, no wallet): a visitor understands the private
 * send + selective-disclosure + claim-link value props and reaches the live
 * on-chain proof page. On-chain actions require a wallet and are intentionally
 * NOT exercised here — we verify every reachable, wallet-less surface.
 */

test.describe("Core flow — value prop & proof", () => {
  test("home communicates the private-send pitch", async ({ page }) => {
    await page.goto("/");

    // The devastating one-liner and the wallet-unmodified promise.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your landlord sees"
    );
    await expect(
      page.getByText(/amount encrypted end-to-end inside Intel TDX/i)
    ).toBeVisible();

    // Honest-limitations footer is present on every page.
    await expect(page.getByText(/amount-privacy only \(addresses public\)/i)).toBeVisible();
  });

  test("claim page offers a wallet-less create-link surface", async ({ page }) => {
    await page.goto("/claim");

    await expect(
      page.getByRole("heading", { name: /Claim a private payment/i })
    ).toBeVisible();
    // With no secret in the URL, the "send to someone without a wallet" panel shows.
    await expect(page.getByText(/Send to someone without a wallet/i)).toBeVisible();
    // A connect prompt gates the actual on-chain action.
    await expect(page.getByRole("button", { name: /connect/i }).first()).toBeVisible();
  });

  test("verify page lists the real deployed contracts and ACL inspector", async ({
    page,
  }) => {
    await page.goto("/verify");

    await expect(
      page.getByRole("heading", { name: /live proof, zero mock/i })
    ).toBeVisible();
    await expect(page.getByText("Deployed contracts")).toBeVisible();

    // The contract rows are anchors read from lib/contracts (no mock).
    await expect(
      page.getByRole("link", { name: /ConfidentialUSD/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /SendLinkEscrow/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Nox protocol/i })
    ).toBeVisible();

    // ACL inspector is present and interactive without a wallet.
    await expect(
      page.getByText(/who can decrypt this handle/i)
    ).toBeVisible();
    await expect(page.getByPlaceholder(/handle 0x/i)).toBeVisible();
  });

  test("ACL inspector validates a bad handle client-side (no wallet needed)", async ({
    page,
  }) => {
    await page.goto("/verify");
    await page.getByPlaceholder(/handle 0x/i).fill("not-a-handle");
    await page.getByRole("button", { name: "Inspect" }).click();
    // Client-side validation rejects a malformed handle before any RPC.
    await expect(page.getByText(/Enter a 32-byte handle/i)).toBeVisible();
  });
});
