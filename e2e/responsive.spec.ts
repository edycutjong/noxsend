import { test, expect } from "@playwright/test";

/**
 * Responsive layout checks at mobile / tablet / desktop widths.
 * These run in demo mode (no wallet) and only assert layout invariants:
 * no horizontal overflow, header fits the viewport, hero text is readable.
 */

const VIEWPORTS = [
  { label: "mobile", width: 375, height: 812 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "desktop", width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Responsive — ${vp.label} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("no horizontal overflow on the home page", async ({ page }) => {
      await page.goto("/");
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      // Allow a 1px rounding tolerance.
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test("brand and hero render within the viewport", async ({ page }) => {
      await page.goto("/");

      const brand = page.getByRole("link", { name: "NoxSend" });
      await expect(brand).toBeVisible();
      const box = await brand.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      }

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });

    test("no horizontal overflow on the verify page", async ({ page }) => {
      await page.goto("/verify");
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}
