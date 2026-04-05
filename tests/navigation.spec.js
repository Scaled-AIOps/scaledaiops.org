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

  const pendingPages = [
    { name: 'Disciplines', path: '/disciplines/' },
    { name: 'Principles', path: '/principles/' },
    { name: 'Roles', path: '/roles/' },
    { name: 'About', path: '/about/' },
    { name: 'ML Engineering', path: '/disciplines/ml-engineering/' },
    { name: 'Model Lifecycle', path: '/disciplines/model-lifecycle/' },
    { name: 'Data Operations', path: '/disciplines/data-operations/' },
    { name: 'Reliability', path: '/disciplines/reliability/' },
    { name: 'Security & Ethics', path: '/disciplines/security-ethics/' },
    { name: 'Strategy', path: '/disciplines/strategy/' },
  ];

  for (const { name, path } of pendingPages) {
    test(`${name} page (${path}) shows proper 404`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response.status()).toBe(404);
      await expect(page).toHaveTitle('Page Not Found — ScaledAIOps');
      await expect(page.locator('h1')).toHaveText('404');
      await expect(page.locator('a.btn-primary')).toHaveAttribute('href', '/');
    });
  }
});
