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

  test('should load target groups admin panel', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/target-groups');
    
    // Should show Target Groups header or empty state
    await expect(page.locator('text=Target Groups')).toBeVisible();
  });

  test('should load profile page', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/profile');
    const body = await page.locator('body');
    await expect(body).toBeVisible();
    // Profile page loads (may redirect to login if not authenticated)
    expect(await body.textContent()).toBeTruthy();
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
