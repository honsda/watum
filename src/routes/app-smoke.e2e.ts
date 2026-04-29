import { expect, test } from '@playwright/test';

test('health and readiness endpoints respond', async ({ request }) => {
	const health = await request.get('/health');
	expect(health.ok()).toBeTruthy();

	const ready = await request.get('/ready');
	expect(ready.ok()).toBeTruthy();
});

test('root renders login form for unauthenticated users', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Masuk')).toBeVisible();
	await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
});

test('internal test route is not exposed in production preview', async ({ request }) => {
	const response = await request.get('/test');
	expect(response.status()).toBe(404);
});

test('demo playwright route still renders', async ({ page }) => {
	await page.goto('/demo/playwright');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
