/**
 * E2E Tests für User Journeys
 * 
 * Testet komplette User-Flows nach Optimierungen
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3005';

test.describe('User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass auth middleware + set active project
    await page.context().addCookies([
      { name: 'audion_auth_token', value: 'e2e-test-token', url: BASE_URL },
      { name: 'audion_project_id', value: 'p1', url: BASE_URL },
    ]);

    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'u1', email: 'e2e@example.com', name: 'E2E User' },
          default_project_id: 'p1',
        }),
      });
    });

    // Stub projects so ProjectProvider does not throw
    await page.route('**/api/projects', async (route) => {
      const url = route.request().url();
      if (route.request().method() !== 'GET') return route.fallback();
      if (url.includes('/api/projects/')) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'p1',
              name: 'Demo Project',
              owner_user_id: 'u1',
              created_at: '2026-02-12T00:00:00Z',
              updated_at: '2026-02-12T00:00:00Z',
            },
          ],
          total: 1,
        }),
      });
    });

    // Default empty stubs for overview fetches
    await page.route('**/api/persona-admin**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const url = route.request().url();
      if (url.includes('/api/persona-admin/')) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 50 }),
      });
    });

    await page.route('**/api/target-groups**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const url = route.request().url();
      if (url.includes('/api/target-groups/')) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 50 }),
      });
    });

    await page.goto(`${BASE_URL}/admin`);
  });

  test('should load personas list', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/personas`);
    await expect(page.getByText('New Persona').first()).toBeVisible();
  });

  test('should open chat interface', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/chat`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load target groups', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/target-groups`);
    await expect(page.getByText('New Target Group').first()).toBeVisible();
  });

  test('should navigate between admin pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/personas`);
    await expect(page).toHaveURL(/\/admin\/personas/);

    await page.goto(`${BASE_URL}/admin/chat`);
    await expect(page).toHaveURL(/\/admin\/chat/);

    await page.goto(`${BASE_URL}/admin/target-groups`);
    await expect(page).toHaveURL(/\/admin\/target-groups/);
  });
});
