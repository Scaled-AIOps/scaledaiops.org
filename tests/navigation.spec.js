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
    await expect(page).toHaveTitle('Page Not Found · ScaledAIOps');
    await expect(page.locator('h1')).toHaveText('404');
  });

  const livePages = [
    { name: 'Disciplines', path: '/disciplines/', titleContains: 'Disciplines' },
    { name: 'Principles', path: '/principles/', titleContains: 'Principles' },
    { name: 'Roles', path: '/roles/', titleContains: 'Roles' },
    { name: 'About', path: '/about/', titleContains: 'About' },
    { name: 'Blog: FFRS', path: '/blog/ffrs/', titleContains: 'FFRS' },
    { name: 'ML Engineering', path: '/disciplines/ml-engineering/', titleContains: 'ML Engineering' },
    { name: 'Model Lifecycle', path: '/disciplines/model-lifecycle/', titleContains: 'Model Lifecycle' },
    { name: 'Data Operations', path: '/disciplines/data-operations/', titleContains: 'Data Operations' },
    { name: 'Reliability', path: '/disciplines/reliability/', titleContains: 'Reliability' },
    { name: 'Security & Ethics', path: '/disciplines/security-ethics/', titleContains: 'Security' },
    { name: 'Strategy', path: '/disciplines/strategy/', titleContains: 'Strategy' },
  ];

  for (const { name, path, titleContains } of livePages) {
    test(`${name} page (${path}) loads successfully`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
      const title = await page.title();
      expect(title).toContain(titleContains);
      await expect(page.locator('h1')).toBeVisible();
    });
  }
});
