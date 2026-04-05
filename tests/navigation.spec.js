const { test, expect } = require('@playwright/test');

test.describe('Navigation', () => {
  test('logo links to homepage', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('.site-logo');
    await expect(logo).toHaveAttribute('href', '/');
    await expect(logo).toContainText('ScaledAIOps');
  });

  test('discipline card links exist', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.card a');
    await expect(links).toHaveCount(6);

    const expectedHrefs = [
      '/disciplines/ml-engineering/',
      '/disciplines/model-lifecycle/',
      '/disciplines/data-operations/',
      '/disciplines/reliability/',
      '/disciplines/security-ethics/',
      '/disciplines/strategy/',
    ];

    for (let i = 0; i < expectedHrefs.length; i++) {
      await expect(links.nth(i)).toHaveAttribute('href', expectedHrefs[i]);
    }
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    const response = await page.goto('/nonexistent-page/');
    expect(response.status()).toBe(404);
    await expect(page).toHaveTitle('Page Not Found — ScaledAIOps');
    await expect(page.locator('h1')).toHaveText('404');
  });
});
