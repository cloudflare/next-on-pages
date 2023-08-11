import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

const frameworkVersion = await fetch(`${DEPLOYMENT_URL}/api/version`).then(
	resp => (resp.status === 200 ? resp.text() : ''),
);

// This doesn't work in next 12
const skipTests = frameworkVersion.startsWith('12');

describe.skipIf(skipTests)('ssg dynamic pages', () => {
	['foo', 'bar', 'baz'].forEach(async route => {
		const path = `/ssg-dynamic/${route}`;

		test(`visiting the statically generated ${path} page`, async ({
			expect,
		}) => {
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
