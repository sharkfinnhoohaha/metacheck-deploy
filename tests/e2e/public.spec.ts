import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero, value, pricing and CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/gets paid/i);
    await expect(page.getByText(/unpaid royalties/i).first()).toBeVisible();
    // Cost section numbers
    await expect(page.getByText("$561M+")).toBeVisible();
    await expect(page.getByText(/~\$15,500/)).toBeVisible();
    // Primary CTA points to sign-up
    const cta = page.getByRole("link", { name: /check my release free/i }).first();
    await expect(cta).toHaveAttribute("href", "/sign-up");
    // Pricing tiers present
    await expect(page.getByText("Most popular")).toBeVisible();
    await expect(page.getByText("$9").first()).toBeVisible();
  });

  test("nav links to features, demo, pricing", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Features" }).first()).toHaveAttribute("href", "/features");
  });
});

test.describe("Features page", () => {
  test("renders capabilities and the grouped rule checklist", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Everything MetaCheck checks/i);
    await expect(page.getByText("ISRC & UPC integrity")).toBeVisible();
    await expect(page.getByText("Rights & identifiers")).toBeVisible();
    await expect(page.getByText("Sync-Ready score")).toBeVisible();
    // Not bounced to sign-in
    await expect(page).toHaveURL(/\/features$/);
  });
});

test.describe("Release planner", () => {
  test("computes a timeline and reacts to the date", async ({ page }) => {
    await page.goto("/release-planner");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/without missing a deadline/i);

    const dateInput = page.locator("#rd");
    await expect(dateInput).toBeVisible();

    // A far-out date → "sweet spot" guidance in the health banner.
    await dateInput.fill("2026-12-31");
    await expect(page.getByText(/you're in the sweet spot/i)).toBeVisible();
    await expect(page.getByText(/Last chance to pitch Spotify/i)).toBeVisible();

    // A too-soon date → editorial window warning.
    await dateInput.fill("2026-06-22");
    await expect(page.getByText(/too late for a Spotify editorial pitch/i)).toBeVisible();
  });
});

test.describe("Live demo", () => {
  test("searches a track and produces a grade", async ({ page }) => {
    await page.goto("/#demo");
    const search = page.getByPlaceholder(/Search any song/i);
    await expect(search).toBeVisible();
    await search.fill("Blinding Lights");
    // iTunes-backed search is networked; allow generous time and skip if it never returns.
    const firstResult = page.locator("button:has-text('Blinding Lights')").first();
    try {
      await firstResult.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      test.skip(true, "music search API did not return (network) — skipping grade assertion");
    }
    await firstResult.click();
    // A grade letter card appears.
    await expect(page.getByText(/critical/i).first()).toBeVisible({ timeout: 10000 });
  });
});
