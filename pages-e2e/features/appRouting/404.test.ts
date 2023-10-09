import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('standard not found pages', () => {
	['/invalid-route', '/404', '/nested/non/existing/route'].map(path =>
		test(`visiting ${path} results in the default 404 page`, async () => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('h1', {
				hasText: '404',
			});

			await assertVisible('h2', {
				hasText: 'This page could not be found.',
			});
		}),
	);
});
