import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('ssr dynamic pages', () => {
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

	describe('standard [...pets] catch all route', () => {
		test('visiting /dog/cat/iguana', async () => {
			const path = '/ssr-dynamic/catch-all/dog/cat/iguana';

			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('p', {
				hasText: 'The provided pets are:',
			});

			await assertVisible('li', {
				hasText: '0 - dog',
			});

			await assertVisible('li', {
				hasText: '1 - cat',
			});

			await assertVisible('li', {
				hasText: '2 - iguana',
			});
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

	describe('catch-all [...pets] route', () => {
		test('visiting /dog/cat/iguana', async () => {
			const path = '/ssr-dynamic/catch-all/dog/cat/iguana';

			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('p', {
				hasText: 'The provided pets are:',
			});

			await assertVisible('li', {
				hasText: '0 - dog',
			});

			await assertVisible('li', {
				hasText: '1 - cat',
			});

			await assertVisible('li', {
				hasText: '2 - iguana',
			});
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

	describe('optional catch-all [[...pets]] route', () => {
		test('visiting /red/green/blue', async () => {
			const path = '/ssr-dynamic/optional-catch-all/red/green/blue';

			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('p', {
				hasText: 'The provided colors are:',
			});

			await assertVisible('li', {
				hasText: '0 - red',
			});

			await assertVisible('li', {
				hasText: '1 - green',
			});

			await assertVisible('li', {
				hasText: '2 - blue',
			});
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
