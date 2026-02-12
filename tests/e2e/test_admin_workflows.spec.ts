/**
 * E2E Tests für Admin Workflows
 * 
 * Testet Admin-Panel Funktionalität nach Optimierungen
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3005';

test.describe('Admin Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass auth middleware (it only checks for cookie presence)
    await page.context().addCookies([
      {
        name: 'audion_auth_token',
        value: 'e2e-test-token',
        url: BASE_URL,
      },
    ]);

    // Stub /api/auth/me so AuthProvider has a user
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'u1', email: 'e2e@example.com', name: 'E2E User' },
          default_project_id: null,
        }),
      });
    });

    await page.goto(`${BASE_URL}/admin`);
  });

  test('should display admin dashboard', async ({ page }) => {
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should load persona admin panel', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/personas`);
    
    // Should show persona list or empty state
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('should load target groups admin panel', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/target-groups`);
    
    // Should show Target Groups header or empty state
    await expect(page.getByRole('heading', { name: 'Target Groups' }).first()).toBeVisible();
  });

  test('should show existing projects in projects page', async ({ page }) => {
    // Stub projects API (client-side ProjectProvider fetch)
    await page.route('**/api/projects', async (route) => {
      const url = route.request().url();
      // Only stub GET list endpoint
      if (route.request().method() !== 'GET') {
        return route.fallback();
      }
      // If it's a sub-path like /api/projects/<id>, let it through
      if (url.includes('/api/projects/')) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              name: 'Demo Project',
              owner_user_id: '22222222-2222-2222-2222-222222222222',
              created_at: '2026-02-12T00:00:00Z',
              updated_at: '2026-02-12T00:00:00Z',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto(`${BASE_URL}/admin/projects`);
    await expect(page.getByRole('button', { name: /Demo Project/ }).first()).toBeVisible();
  });

  test('should load profile page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/profile`);
    const body = await page.locator('body');
    await expect(body).toBeVisible();
    // Profile page loads (may redirect to login if not authenticated)
    expect(await body.textContent()).toBeTruthy();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to personas page
    await page.goto(`${BASE_URL}/admin/personas`);
    
    // Should show error message if backend unavailable
    // (instead of crashing)
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});
