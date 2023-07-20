import { describe, it } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('Simple App Static SPA navigation', () => {
	it('should soft navigate between static routes', async ({ expect }) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		const requestUrls: string[] = [];
		await page.route('**/*', route => {
			requestUrls.push(route.request().url());
			route.continue();
		});

		await page.goto(`${DEPLOYMENT_URL}/ssr-navigation`);

		await assertVisible('h1', { hasText: 'Server Side Rendered Navigation' });
		await assertVisible('h2', { hasText: 'Server Side Rendered Index' });

		await page.locator('a', { hasText: 'to page A' }).click();

		await assertVisible('h2', { hasText: 'Server Side Rendered Page A' });

		await page.locator('a', { hasText: 'to page B' }).click();

		await assertVisible('h2', { hasText: 'Server Side Rendered Page B' });

		await page.goBack();

		await assertVisible('h2', { hasText: 'Server Side Rendered Page A' });

		const hardNavigationRequests = requestUrls.filter(url => {
			const urlObj = new URL(url);
			const searchParams = urlObj.searchParams;
			const isNextInternalRequest = url.startsWith(`${DEPLOYMENT_URL}/_next`);
			if (isNextInternalRequest) return false;

			const isReactServerComponentRequest = searchParams.get('_rsc');
			return !isReactServerComponentRequest;
		});

		// TODO: TO FIX AND RE-ENABLE
		// expect(hardNavigationRequests.length).toBe(1);
		// expect(hardNavigationRequests[0]).toBe(`${DEPLOYMENT_URL}/ssr-navigation`);
	});
});
