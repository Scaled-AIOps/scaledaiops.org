const { test, expect } = require('@playwright/test');

test.describe('Responsive design', () => {
  test('mobile nav toggle is visible on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    await expect(toggle).toBeVisible();
  });

  test('mobile nav toggle opens menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const nav = page.locator('.site-nav');
    await expect(nav).not.toBeVisible();
    await page.locator('.nav-toggle').click();
    await expect(nav).toBeVisible();
  });

  test('nav toggle is hidden on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    await expect(toggle).not.toBeVisible();
  });

  test('cards stack on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const firstCard = page.locator('.card-grid .card').first();
    const box = await firstCard.boundingBox();
    // Card should be nearly full width on mobile
    expect(box.width).toBeGreaterThan(300);
  });
});
