import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('ssg dynamic pages', () => {
	['foo', 'bar', 'baz'].forEach(route => {
		const path = `/ssg-dynamic/${route}`;
		test(`visiting the statically generated ${path} page`, async () => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('h1', {
				hasText: 'SSGed Dynamic Page',
			});

			await assertVisible('p', {
				hasText: `slug: ${route}`,
			});
		});
	});

	['foo/bar', 'non-existent'].forEach(route => {
		const path = `/ssg-dynamic/${route}`;
		test(`visiting an invalid / not statically generated ${path} page`, async () => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('h1', {
				hasText: '404',
			});
		});
	});
});
