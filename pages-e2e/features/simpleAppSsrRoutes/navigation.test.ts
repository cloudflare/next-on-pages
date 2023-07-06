import { describe, it } from 'vitest';

describe('Simple App Static SPA navigation', () => {
	it('should soft navigate between static routes', async ({ expect }) => {
		const page = await BROWSER.newPage();

		const requestUrls: string[] = [];
		await page.route('**/*', route => {
			requestUrls.push(route.request().url());
			route.continue();
		});

		await page.goto(`${DEPLOYMENT_URL}/ssr-navigation`);

		expect(
			await page
				.locator('h1', { hasText: 'Server Side Rendered Navigation' })
				.isVisible()
		).toBe(true);
		expect(
			await page
				.locator('h2', { hasText: 'Server Side Rendered Index' })
				.isVisible()
		).toBe(true);

		await page.locator('a', { hasText: 'to page A' }).click();

		await page
			.locator('h2', { hasText: 'Server Side Rendered Page A' })
			.waitFor();
		expect(
			await page
				.locator('h2', { hasText: 'Server Side Rendered Page A' })
				.isVisible()
		).toBe(true);

		await page.locator('a', { hasText: 'to page B' }).click();

		await page
			.locator('h2', { hasText: 'Server Side Rendered Page B' })
			.waitFor();
		expect(
			await page
				.locator('h2', { hasText: 'Server Side Rendered Page B' })
				.isVisible()
		).toBe(true);

		await page.goBack();

		await page
			.locator('h2', { hasText: 'Server Side Rendered Page A' })
			.waitFor();
		expect(
			await page
				.locator('h2', { hasText: 'Server Side Rendered Page A' })
				.isVisible()
		).toBe(true);

		const hardNavigationRequests = requestUrls.filter(url => {
			const urlObj = new URL(url);
			const searchParams = urlObj.searchParams;
			const isNextInternalRequest = url.startsWith(`${DEPLOYMENT_URL}/_next`);
			if (isNextInternalRequest) return false;

			const isReactServerComponentRequest = searchParams.get('_rsc');
			return !isReactServerComponentRequest;
		});

		expect(hardNavigationRequests.length).toBe(1);
		expect(hardNavigationRequests[0]).toBe(`${DEPLOYMENT_URL}/ssr-navigation`);
	});
});
