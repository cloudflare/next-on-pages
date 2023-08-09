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
				await page.goto(`${DEPLOYMENT_URL}/navigation`);

				await assertVisible('h1', { hasText: 'Navigation' });
				await assertVisible('h2', { hasText: 'Index' });

				await page.locator('a', { hasText: 'to page A' }).click();

				await assertVisible('h2', { hasText: 'Page A' });

				await page.locator('a', { hasText: 'to page B' }).click();

				await assertVisible('h2', { hasText: 'Page B' });

				await page.goBack();

				await assertVisible('h2', { hasText: 'Page A' });

				await page.goto(`${DEPLOYMENT_URL}/navigation/pageB`);

				await assertVisible('h2', { hasText: 'Page B' });
			},
			async hardNavigations => {
				expect(hardNavigations.map(({ url }) => url)).toEqual([
					`${DEPLOYMENT_URL}/navigation`,
					`${DEPLOYMENT_URL}/navigation/pageB`,
				]);
			},
		);
	});
});
