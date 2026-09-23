const { test, expect } = require('@playwright/test');

// FFRS is a feature toggle: these tests only run when the site was built with FFRS_ENABLED=true.
test.describe('FFRS feedback widget', () => {
  test.skip(process.env.FFRS_ENABLED !== 'true', 'FFRS_ENABLED is not true');

  test.beforeEach(async ({ page }) => {
    // Never create real feedback from tests — stub the API and Turnstile (a token can't be issued for the test host).
    await page.route('**/api/feedback', (route) =>
      route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ref: 'FB-TEST42', status: 'received' }) }),
    );
    await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("test-token"),0);return "w1";},reset:()=>{}};' }),
    );
    await page.goto('/');
  });

  test('edge tab is visible and opens the dialog', async ({ page }) => {
    const tab = page.locator('.ffrs-tab');
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.locator('.ffrs-dialog')).toBeVisible();
    await expect(page.locator('#ffrs-title')).toHaveText('Send feedback');
    await expect(page.locator('.ffrs-page code')).toHaveText('/');
  });

  test('bug tab shows severity and captures a screenshot; feature tab hides both', async ({ page }) => {
    await page.locator('.ffrs-tab').click();
    await expect(page.locator('.ffrs-sev')).toBeHidden();
    await page.locator('[role=tab][data-kind=bug]').click();
    await expect(page.locator('.ffrs-sev')).toBeVisible();
    await expect(page.locator('.ffrs-shot')).toBeVisible({ timeout: 15000 });
    await page.locator('.ffrs-shot-x').click();
    await expect(page.locator('.ffrs-shot')).toBeHidden();
    await page.locator('[role=tab][data-kind=feature]').click();
    await expect(page.locator('.ffrs-sev')).toBeHidden();
  });

  test('submits and shows the reference', async ({ page }) => {
    await page.locator('.ffrs-tab').click();
    await page.fill('.ffrs-form [name=title]', 'Add an RSS feed');
    await page.fill('.ffrs-form [name=body]', 'A feed of framework changes would help me follow along.');
    await page.locator('.ffrs-submit').click();
    await expect(page.locator('.ffrs-done')).toBeVisible();
    await expect(page.locator('.ffrs-ref')).toHaveText('FB-TEST42');
    await expect(page.locator('.ffrs-link')).toHaveAttribute('href', '/feedback/?ref=FB-TEST42');
  });

  test('consent without email is blocked client-side', async ({ page }) => {
    await page.locator('.ffrs-tab').click();
    await page.fill('.ffrs-form [name=title]', 'Add an RSS feed');
    await page.fill('.ffrs-form [name=body]', 'A feed of framework changes would help me follow along.');
    await page.check('.ffrs-form [name=consent]');
    await page.locator('.ffrs-submit').click();
    await expect(page.locator('.ffrs-err')).toContainText('Add your email');
  });

  test('/feedback/ fallback page renders form and lookup', async ({ page }) => {
    await page.goto('/feedback/');
    await expect(page.locator('h1')).toHaveText('Feedback');
    await expect(page.locator('.ffrs-page-form [name=kind]')).toBeVisible();
    await expect(page.locator('.ffrs-lookup [name=ref]')).toBeVisible();
    await expect(page.locator('.ffrs-tab')).toHaveCount(0); // widget hides itself here
  });
});
