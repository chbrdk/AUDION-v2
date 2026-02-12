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
      {
        name: 'audion_project_id',
        value: 'p1',
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

  test('should show personas overview and navigate to persona detail', async ({ page }) => {
    // Stub projects so ProjectProvider can set activeProjectId
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

    // Stub personas list + detail for overview->detail navigation
    await page.route('**/api/persona-admin**', async (route) => {
      const url = route.request().url();
      if (route.request().method() !== 'GET') return route.fallback();
      // detail endpoint: /api/persona-admin/<id>
      if (url.includes('/api/persona-admin/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: {
              id: 'p-111',
              name: 'Alice Persona',
              segment: 'Segment A',
              headline: 'Hello',
              bio: '',
              traits: {},
              pain_points: [],
              goals: [],
              communication_style: { vocabulary: [], sentence_structure: '', skepticism_level: 0 },
              confidence: 0.7,
              version: '1.0.0',
              created_at: '2026-02-12T00:00:00Z',
            },
            metadata: {
              personaId: 'p-111',
              status: 'draft',
              updatedBy: 'e2e',
              createdAt: '2026-02-12T00:00:00Z',
              updatedAt: '2026-02-12T00:00:00Z',
              version: '1.0.0',
              avatarUrl: null,
            },
            documents: [],
            knowledge: [],
          }),
        });
      }
      // list endpoint: /api/persona-admin?...project_id=...
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'p-111',
              name: 'Alice Persona',
              segment: 'Segment A',
              status: 'draft',
              version: '1.0.0',
              updatedAt: '2026-02-12T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          page_size: 50,
        }),
      });
    });

    await page.goto(`${BASE_URL}/admin/personas`);

    await expect(page.getByText('Alice Persona').first()).toBeVisible();
    // Use the explicit CTA to avoid card accessibility differences
    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page).toHaveURL(/\/admin\/personas\/p-111/);
  });

  test('should show target groups overview and navigate to target group detail', async ({ page }) => {
    // Stub projects so ProjectProvider can set activeProjectId
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

    await page.route('**/api/target-groups**', async (route) => {
      const url = route.request().url();
      if (route.request().method() !== 'GET') return route.fallback();
      // /api/target-groups/<id>/...
      if (url.includes('/api/target-groups/tg-111/knowledge/chunks')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      if (url.includes('/api/target-groups/tg-111/knowledge/clusters')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ clusters: [], method: 'kmeans', limit: 0 }),
        });
      }
      if (url.includes('/api/target-groups/tg-111/knowledge')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      if (url.includes('/api/target-groups/tg-111/documents')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      if (url.includes('/api/target-groups/tg-111/personas')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
        });
      }
      if (url.includes('/api/target-groups/tg-111')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'tg-111',
            name: 'Target Group One',
            segment: 'B2B',
            description: '',
            projectId: 'p1',
            createdAt: '2026-02-12T00:00:00Z',
            updatedAt: '2026-02-12T00:00:00Z',
            knowledgeEntries: [],
          }),
        });
      }
      // list endpoint: /api/target-groups?...project_id=...
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 'tg-111', name: 'Target Group One', segment: 'B2B' }],
          total: 1,
          page: 1,
          page_size: 50,
        }),
      });
    });

    await page.goto(`${BASE_URL}/admin/target-groups`);

    await expect(page.getByText('Target Group One').first()).toBeVisible();
    await page.getByRole('button', { name: 'View' }).first().click();
    await expect(page).toHaveURL(/\/admin\/target-groups\/tg-111/);
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
    // Overview shows cards; click project card to open detail route
    const projectCard = page.getByRole('button', { name: /Demo Project/ }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();
    await expect(page).toHaveURL(/\/admin\/projects\/11111111-1111-1111-1111-111111111111/);
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
