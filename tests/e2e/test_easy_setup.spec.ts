/**
 * E2E: AI easy setup wizard (/admin/setup)
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3005";

test.describe("Easy setup wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "audion_auth_token",
        value: "e2e-test-token",
        url: BASE_URL,
      },
    ]);

    await page.route("**/api/auth/me", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "u-easy", email: "easy@example.com", name: "Easy User" },
          default_project_id: null,
        }),
      });
    });

    await page.route("**/api/projects**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes("/api/projects/bootstrap") && method === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            project: { id: "proj-easy-1", name: "Acme Co" },
            target_group: { id: "tg-easy-1", name: "Buyers", segment: "b2b" },
            persona: { id: "per-easy-1", name: "Alex Buyer", segment: "b2b" },
            website_excerpt_included: false,
          }),
        });
      }

      if (
        method === "GET" &&
        (url.split("?")[0].endsWith("/api/projects") || /\/api\/projects$/.test(url.split("?")[0]))
      ) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0 }),
        });
      }

      return route.fallback();
    });
  });

  test("submits easy setup and shows success", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/setup`);

    await page.getByLabel(/Customer|Kunde/i).fill("Acme Co");
    await page.getByLabel(/What is|Worum geht/i).fill("We sell analytics to mid-market teams.");

    await page.getByRole("button", { name: /Create with AI|Mit KI erstellen/i }).click();

    await expect(page.getByText(/Persona:|Alex Buyer/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

