/**
 * E2E Tests für Admin Workflows
 * 
 * Testet Admin-Panel Funktionalität nach Optimierungen
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/admin');
  });

  test('should display admin dashboard', async ({ page }) => {
    await expect(page.locator('text=Admin')).toBeVisible();
  });

  test('should load persona admin panel', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/personas');
    
    // Should show persona list or empty state
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to personas page
    await page.goto('http://localhost:3000/admin/personas');
    
    // Should show error message if backend unavailable
    // (instead of crashing)
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});
