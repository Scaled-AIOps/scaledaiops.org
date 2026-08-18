const { test, expect } = require('@playwright/test');

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('ScaledAIOps — the open framework for running AI in production');
  });

  test('displays hero section', async ({ page }) => {
    const hero = page.locator('.hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('h1')).toHaveText('The open framework for running AI in production.');
    await expect(hero.locator('.subtitle')).toContainText('community-maintained');
  });

  test('displays all six discipline cards', async ({ page }) => {
    const cards = page.locator('.card-grid .card');
    await expect(cards).toHaveCount(6);

    const expectedTitles = [
      'ML Engineering & Platform',
      'Model Lifecycle Management',
      'Data Operations',
      'Reliability & Observability',
      'Security, Ethics & Compliance',
      'Strategy & Organization',
    ];

    for (let i = 0; i < expectedTitles.length; i++) {
      await expect(cards.nth(i).locator('h3')).toHaveText(expectedTitles[i]);
    }
  });

  test('displays all eight guiding principles', async ({ page }) => {
    const principles = page.locator('.principle-item');
    await expect(principles).toHaveCount(8);
  });

  test('has working navigation links', async ({ page }) => {
    const nav = page.locator('.site-nav');
    await expect(nav.locator('a')).toHaveCount(6);
    await expect(nav.locator('a[href="/"]')).toHaveText('Framework');
    await expect(nav.locator('a[href="/disciplines/"]')).toHaveText('Disciplines');
    await expect(nav.locator('a[href="/principles/"]')).toHaveText('Principles');
    await expect(nav.locator('a[href="/roles/"]')).toHaveText('Roles');
    await expect(nav.locator('a[href="/about/"]')).toHaveText('About');
  });

  test('has GitHub link in nav', async ({ page }) => {
    const ghLink = page.locator('.site-nav a[href="https://github.com/Scaled-AIOps"]');
    await expect(ghLink).toBeVisible();
    await expect(ghLink).toHaveText('GitHub');
  });

  test('displays footer with license', async ({ page }) => {
    const footer = page.locator('.site-footer');
    await expect(footer).toContainText('CC BY-SA 4.0');
    await expect(footer).toContainText('2026');
  });

  test('community section has contribute link', async ({ page }) => {
    const cta = page.locator('.community a.btn-primary');
    await expect(cta).toHaveText('Contribute on GitHub');
    await expect(cta).toHaveAttribute('href', 'https://github.com/Scaled-AIOps');
  });
});
