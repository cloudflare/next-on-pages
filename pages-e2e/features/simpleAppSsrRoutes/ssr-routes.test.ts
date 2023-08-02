import { describe, it } from 'vitest';

describe('Simple App SSR Routes', () => {
	it('should return a page with a server-side rendered message', async ({
		expect,
	}) => {
		const page = await BROWSER.newPage();
		await page.goto(`${DEPLOYMENT_URL}/routeA`);

		const h1Text = await page.locator('h1').textContent();
		expect(h1Text).toContain('This route was Server Side Rendered');
	});
});
