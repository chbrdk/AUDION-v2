/**
 * E2E Tests für User Journeys
 * 
 * Testet komplette User-Flows nach Optimierungen
 */

import { test, expect } from '@playwright/test';

test.describe('User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin panel
    await page.goto('http://localhost:3000/admin');
  });

  test('should load personas list', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/personas');
    
    // Should load persona list
    await expect(page.locator('text=Personas')).toBeVisible();
  });

  test('should open chat interface', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/chat');
    
    // Should load chat interface
    await expect(page.locator('text=Chat')).toBeVisible();
  });

  test('should load target groups', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/target-groups');
    
    // Should load target groups
    await expect(page.locator('text=Target Groups')).toBeVisible();
  });

  test('should navigate between admin pages', async ({ page }) => {
    // Start at personas
    await page.goto('http://localhost:3000/admin/personas');
    
    // Navigate to chat
    await page.click('text=Chat');
    await expect(page).toHaveURL(/.*\/admin\/chat/);
    
    // Navigate to target groups
    await page.click('text=Target Groups');
    await expect(page).toHaveURL(/.*\/admin\/target-groups/);
  });
});
