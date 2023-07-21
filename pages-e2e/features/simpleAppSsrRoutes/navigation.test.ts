import { describe, it } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';
import { collectHardNavigationRequests } from '@features-utils/collectHardNavigationRequests';

describe('Simple App Static SPA navigation', () => {
	it('should soft navigate between static routes', async ({ expect }) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		const hardNavigationRequests = await collectHardNavigationRequests(page);

		await page.goto(`${DEPLOYMENT_URL}/ssr-navigation`);

		await assertVisible('h1', { hasText: 'Server Side Rendered Navigation' });
		await assertVisible('h2', { hasText: 'Server Side Rendered Index' });

		await page.locator('a', { hasText: 'to page A' }).click();

		await assertVisible('h2', { hasText: 'Server Side Rendered Page A' });

		await page.locator('a', { hasText: 'to page B' }).click();

		await assertVisible('h2', { hasText: 'Server Side Rendered Page B' });

		await page.goBack();

		await assertVisible('h2', { hasText: 'Server Side Rendered Page A' });

		expect(hardNavigationRequests.length).toBe(1);
		expect(hardNavigationRequests[0].url()).toBe(
			`${DEPLOYMENT_URL}/ssr-navigation`,
		);
	});
});
