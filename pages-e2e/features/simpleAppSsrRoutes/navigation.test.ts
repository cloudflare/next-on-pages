import { describe, it } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';
import { runWithHardNavigationsChecking } from '@features-utils/runWithHardNavigationsChecking';

describe('Simple App Static SPA navigation', () => {
	it('should soft navigate between static routes', async ({ expect }) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		await runWithHardNavigationsChecking(
			page,
			async () => {
				await page.goto(`${DEPLOYMENT_URL}/ssr-navigation`);

				await assertVisible('h1', {
					hasText: 'Server Side Rendered Navigation',
				});
				await assertVisible('h2', { hasText: 'Server Side Rendered Index' });

				await page.locator('a', { hasText: 'to page A' }).click();

				await assertVisible('h2', { hasText: 'Server Side Rendered Page A' });

				await page.locator('a', { hasText: 'to page B' }).click();

				await assertVisible('h2', { hasText: 'Server Side Rendered Page B' });

				await page.goBack();

				await assertVisible('h2', { hasText: 'Server Side Rendered Page A' });

				await page.goto(`${DEPLOYMENT_URL}/ssr-navigation/pageB`);

				await assertVisible('h2', { hasText: 'Server Side Rendered Page B' });
			},
			async hardNavigations => {
				expect(hardNavigations.map(({ url }) => url)).toEqual([
					`${DEPLOYMENT_URL}/ssr-navigation`,
					`${DEPLOYMENT_URL}/ssr-navigation/pageB`,
				]);
			},
		);
	});
});
