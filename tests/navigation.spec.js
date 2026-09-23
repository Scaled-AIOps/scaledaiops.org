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
      '/disciplines/ai-augmented-delivery/',
      '/disciplines/human-ai-workflow-design/',
      '/disciplines/tooling-context-engineering/',
      '/disciplines/governance-guardrails/',
      '/disciplines/skills-roles/',
      '/disciplines/value-measurement/',
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
    { name: 'Lifecycle', path: '/lifecycle/', titleContains: 'lifecycle' },
    { name: 'Disciplines', path: '/disciplines/', titleContains: 'Disciplines' },
    { name: 'Pillars', path: '/pillars/', titleContains: 'pillars' },
    { name: 'Maturity', path: '/maturity/', titleContains: 'Maturity' },
    { name: 'Principles', path: '/principles/', titleContains: 'Principles' },
    { name: 'Roles', path: '/roles/', titleContains: 'Roles' },
    { name: 'About', path: '/about/', titleContains: 'About' },
    { name: 'Blog', path: '/blog/', titleContains: 'Blog' },
    { name: 'Blog: FFRS', path: '/blog/ffrs/', titleContains: 'FFRS' },
    { name: 'Blog: AI adoption framework', path: '/blog/ai-adoption-framework/', titleContains: 'working with AI' },
    { name: 'Legacy archive', path: '/legacy/', titleContains: 'Legacy' },
    { name: 'AI-Augmented Delivery', path: '/disciplines/ai-augmented-delivery/', titleContains: 'AI-Augmented Delivery' },
    { name: 'Human–AI Workflow Design', path: '/disciplines/human-ai-workflow-design/', titleContains: 'Workflow Design' },
    { name: 'Tooling & Context Engineering', path: '/disciplines/tooling-context-engineering/', titleContains: 'Context Engineering' },
    { name: 'Governance & Guardrails', path: '/disciplines/governance-guardrails/', titleContains: 'Guardrails' },
    { name: 'Skills & Roles', path: '/disciplines/skills-roles/', titleContains: 'Skills' },
    { name: 'Value & Measurement', path: '/disciplines/value-measurement/', titleContains: 'Value' },
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

  const archived = ['ml-engineering', 'model-lifecycle', 'data-operations', 'reliability', 'security-ethics', 'strategy'];
  for (const slug of archived) {
    test(`old /disciplines/${slug}/ redirects to the legacy archive`, async ({ page }) => {
      await page.goto(`/disciplines/${slug}/`);
      await expect(page).toHaveURL(new RegExp(`/legacy/#${slug}$`));
      await expect(page.locator(`#${slug}`)).toBeAttached();
    });
  }

  test('old hardware post redirects to the legacy archive', async ({ page }) => {
    await page.goto('/blog/hardware-for-llm-training/');
    await expect(page).toHaveURL(/\/legacy\/#hardware-for-llm-training$/);
  });
});
