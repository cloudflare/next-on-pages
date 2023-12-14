import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

const frameworkVersion = await fetch(`${DEPLOYMENT_URL}/api/version`).then(
	resp => (resp.status === 200 ? resp.text() : ''),
);

// This doesn't work in next 12
const skipTests = frameworkVersion.startsWith('12');

describe.skipIf(skipTests)('ssr dynamic pages', () => {
	describe('standard [pageName] route', () => {
		['page-abc', 'page-xyz', 'page-123'].forEach(route => {
			const path = `/ssr-dynamic/page/${route}`;
			test(`visiting ${path}`, async () => {
				const page = await BROWSER.newPage();
				const assertVisible = getAssertVisible(page);

				await page.goto(`${DEPLOYMENT_URL}${path}`);

				await assertVisible('p', {
					hasText: `This Page's name is: ${route}`,
				});
			});
		});
	});

	describe('catch-all [...pets] route (basic functionality)', () => {
		test('visiting /dog/cat/iguana', async () => {
			const path = '/ssr-dynamic/catch-all/dog/cat/iguana';

			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('p', {
				hasText: 'The provided pets are:',
			});

			// Note: the slugs rendering is not tested here as it has not been
			//       working properly in next-on-pages until Next.js v14.0.4
			//       (for later versions of Next.js we do test the slugs in
			//       the pagesRoutingSsrDynamicCatchAll feature)
		});

		test('visiting / (without providing the required pets)', async () => {
			const path = '/ssr-dynamic/catch-all/';

			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('h1', {
				hasText: '404',
			});
		});
	});

	describe('optional catch-all [[...pets]] route (basic functionality)', () => {
		test('visiting /red/green/blue', async () => {
			const path = '/ssr-dynamic/optional-catch-all/red/green/blue';

			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('p', {
				hasText: 'The provided colors are:',
			});

			// Note: the slugs rendering is not tested here as it has not been
			//       working properly in next-on-pages until Next.js v14.0.4
			//       (for later versions of Next.js we do test the slugs in
			//       the pagesRoutingSsrDynamicCatchAll feature)
		});

		test('visiting / (without providing the colors)', async () => {
			const path = '/ssr-dynamic/optional-catch-all';

			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('p', {
				hasText: 'No color provided',
			});
		});
	});

	['foo/bar', 'non-existent'].forEach(route => {
		const path = `/ssr-dynamic/${route}`;
		test(`visiting an invalid / ${path} page`, async () => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('h1', {
				hasText: '404',
			});
		});
	});
});
