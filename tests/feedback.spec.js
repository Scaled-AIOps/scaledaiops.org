const { test, expect } = require('@playwright/test');

// FFRS is a feature toggle: these tests only run when the site was built with FFRS_ENABLED=true.
// The widget comes from the shared service (ffrs.scaledaiops.org) and renders in a shadow root;
// Playwright's CSS locators pierce open shadow roots, so plain class selectors reach it.
test.describe('FFRS feedback widget', () => {
  test.skip(process.env.FFRS_ENABLED !== 'true', 'FFRS_ENABLED is not true');

  test.beforeEach(async ({ page }) => {
    // Never create real feedback from tests — stub the API and Turnstile (a token can't be issued for the test host).
    await page.route('**/api/feedback', (route) =>
      route.fulfill({
        status: 202, contentType: 'application/json',
        body: JSON.stringify({ ref: 'FB-TEST42', status: 'received', statusUrl: 'https://www.scaledaiops.org/feedback/?ref=FB-TEST42' }),
      }),
    );
    await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("test-token"),0);return "w1";},reset:()=>{}};' }),
    );
    await page.goto('/');
  });

  test('edge tab is visible and opens the dialog', async ({ page }) => {
    const tab = page.locator('[data-ffrs] .tab');
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('#ffrs-title')).toHaveText('Send feedback');
  });

  test('bug shows severity and captures a screenshot; feature hides both', async ({ page }) => {
    await page.locator('.tab').click();
    await expect(page.locator('.sev')).toBeHidden();
    await page.locator('[name=kind]').selectOption('bug');
    await expect(page.locator('.sev')).toBeVisible();
    await expect(page.locator('.shot')).toBeVisible({ timeout: 15000 });
    await page.locator('.shot-x').click();
    await expect(page.locator('.shot')).toBeHidden();
    await page.locator('[name=kind]').selectOption('feature');
    await expect(page.locator('.sev')).toBeHidden();
  });

  test('submits and shows the reference with a status link', async ({ page }) => {
    await page.locator('.tab').click();
    await page.fill('[name=title]', 'Add an RSS feed');
    await page.fill('[name=body]', 'A feed of framework changes would help me follow along.');
    await page.locator('.send').click();
    await expect(page.locator('.msg')).toContainText('FB-TEST42');
    await expect(page.locator('.msg a')).toHaveAttribute('href', 'https://www.scaledaiops.org/feedback/?ref=FB-TEST42');
  });

  test('consent without email is blocked client-side', async ({ page }) => {
    await page.locator('.tab').click();
    await page.fill('[name=title]', 'Add an RSS feed');
    await page.fill('[name=body]', 'A feed of framework changes would help me follow along.');
    await page.check('[name=consent]');
    await page.locator('.send').click();
    await expect(page.locator('.msg')).toContainText('Add an email');
  });

  test('/feedback/ fallback page renders form and lookup', async ({ page }) => {
    await page.goto('/feedback/');
    await expect(page.locator('h1')).toHaveText('Feedback');
    await expect(page.locator('.ffrs-page-form [name=kind]')).toBeVisible();
    await expect(page.locator('.ffrs-lookup [name=ref]')).toBeVisible();
    await expect(page.locator('[data-ffrs]')).toHaveCount(0); // data-hide-on keeps the tab off this page
  });
});
