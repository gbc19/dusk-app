import { test, expect, type Page } from '@playwright/test';
async function backendMode(page: Page, invalid = false) {
  await page.route(/https:\/\/(?:images\.unsplash\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => route.abort());
  await page.route(/\/src\/main\.tsx(?:\?|$)/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('readBackendConfig(import.meta.env,', `readBackendConfig({...import.meta.env,VITE_DATA_MODE:'backend',VITE_SUPABASE_URL:'http://127.0.0.1:55321',VITE_SUPABASE_PUBLISHABLE_KEY:'${invalid ? 'sb_secret_test' : 'sb_publishable_synthetic'}'},`);
    await route.fulfill({ response, body });
  });
}
test('backend empty feeds remain empty and anonymous discovery needs no account', async ({ page }) => {
  await backendMode(page);
  await page.route('http://127.0.0.1:55321/rest/v1/**', route => route.fulfill({ json: [], headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.getByText('No published venues or offers. Publication is disabled.')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0); await expect(page.getByLabel('Choose city')).toHaveValue('Las Vegas');
  await page.getByLabel('Choose city').selectOption('New York City'); await expect(page.locator('.card')).toHaveCount(0);
  await page.getByText('Local test account', { exact: true }).click(); await expect(page.getByRole('button', { name: 'Register test account' })).toBeVisible();
  await expect(page.getByText('Cinder Circuit', { exact: true })).toHaveCount(0);
});
test('backend outage has a retry and never substitutes demo venues', async ({ page }) => {
  await backendMode(page); await page.route('http://127.0.0.1:55321/**', route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.getByText('Backend unavailable. No listings loaded.')).toBeVisible(); await expect(page.locator('.card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh backend' }).click(); await expect(page.getByText('Backend unavailable. No listings loaded.')).toBeVisible();
});
test('invalid configuration fails without falling back or displaying keys', async ({ page }) => {
  await backendMode(page, true); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Backend configuration unavailable' })).toBeVisible(); await expect(page.locator('body')).not.toContainText('sb_secret_test'); await expect(page.locator('.card')).toHaveCount(0);
});
