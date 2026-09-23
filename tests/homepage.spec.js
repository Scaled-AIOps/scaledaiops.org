const { test, expect } = require('@playwright/test');

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('ScaledAIOps — the open framework for adopting AI across software delivery');
  });

  test('displays hero section', async ({ page }) => {
    const hero = page.locator('.hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('h1')).toHaveText('The open framework for adopting AI across software delivery.');
    await expect(hero.locator('.subtitle')).toContainText('SDLC, CI/CD and DevOps');
  });

  test('displays all six discipline cards', async ({ page }) => {
    const cards = page.locator('.card-grid .card');
    await expect(cards).toHaveCount(6);

    const expectedTitles = [
      'AI-Augmented Delivery',
      'Human–AI Workflow Design',
      'Tooling & Context Engineering',
      'Governance & Guardrails',
      'Skills & Roles',
      'Value & Measurement',
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
    await expect(nav.locator('a')).toHaveCount(7);
    await expect(nav.locator('a[href="/lifecycle/"]')).toHaveText('Lifecycle');
    await expect(nav.locator('a[href="/disciplines/"]')).toHaveText('Disciplines');
    await expect(nav.locator('a[href="/pillars/"]')).toHaveText('Pillars');
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

  test('shows the lifecycle from Conceive to Retire', async ({ page }) => {
    const stages = page.locator('#lifecycle .lifecycle li');
    await expect(stages).toHaveCount(9);
    await expect(stages.first()).toContainText('Conceive');
    await expect(stages.last()).toContainText('Retire');
  });
});
