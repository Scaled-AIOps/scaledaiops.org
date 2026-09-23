const { test, expect } = require('@playwright/test');

test.describe('Maturity self-assessment', () => {
  test('shows the full 6 × 5 model', async ({ page }) => {
    await page.goto('/maturity/');
    await expect(page.locator('.maturity-grid tbody tr')).toHaveCount(6);
    await expect(page.locator('.maturity-grid thead th.lvl')).toHaveCount(5);
  });

  test('produces a profile and next steps from the answers', async ({ page }) => {
    await page.goto('/maturity/');
    const result = page.locator('#assess-result');
    await expect(result).toBeHidden();
    await page.locator('input[name="d0"][value="2"]').check();
    await page.locator('input[name="d3"][value="4"]').check();
    await expect(result).toBeVisible();
    await expect(page.locator('#assess-bars .assess-bar')).toHaveCount(2);
    await expect(page.locator('#assess-summary')).toContainText('Average 3.0 across 2 of 6');
    await expect(page.locator('#assess-next li').first()).toContainText('AI-Augmented Delivery to Managed');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(result).toBeHidden();
  });
});
