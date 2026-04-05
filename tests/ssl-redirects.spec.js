const { test, expect } = require('@playwright/test');

test.describe('SSL & Redirects', () => {
  test('www serves over HTTPS', async ({ page }) => {
    const response = await page.goto('https://www.scaledaiops.org');
    expect(response.status()).toBe(200);
    expect(response.url()).toBe('https://www.scaledaiops.org/');
  });

  test('framework subdomain serves over HTTPS', async ({ page }) => {
    const response = await page.goto('https://framework.scaledaiops.org');
    expect(response.status()).toBe(200);
  });

  test('HTTP redirects to HTTPS', async ({ page }) => {
    const response = await page.goto('http://www.scaledaiops.org');
    expect(response.url()).toContain('https://');
  });

  test('apex domain redirects to www', async ({ page }) => {
    const response = await page.goto('https://scaledaiops.org');
    expect(response.url()).toContain('www.scaledaiops.org');
  });
});
