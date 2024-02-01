import { getAssertVisible } from '@features-utils/getAssertVisible';
import { describe, test } from 'vitest';

describe('next.config.mjs Rewrites', () => {
	// Note: in next you can have basic rewrites or rewrites categorized under "beforeFiles", "afterFiles"
	//       and "fallbacks", since you can have both and categorized rewrites here we choose to test
	//       categorized ones (if this works it should imply that also t he basic ones do)
	//       if need be we might add new fixtures+features to also test basic ones

	describe('beforeFiles', () => {
		test('no rewrite is applied when not requested', async ({ expect }) => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			const pageUrl = `${DEPLOYMENT_URL}/configs-rewrites/some-page`;

			await page.goto(pageUrl);

			await assertVisible('h1', { hasText: 'This is the "some-page" page' });

			expect(page.url()).toEqual(pageUrl);
		});

		test('rewrite based wildcard path matching', async ({ expect }) => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			const pageUrl = `${DEPLOYMENT_URL}/configs-rewrites/wildcard/my-page`;

			await page.goto(pageUrl);

			await assertVisible('h1', {
				hasText: 'This is the "rewritten-wildcard/my-page" page',
			});

			expect(page.url()).toEqual(pageUrl);
		});

		test('simple rewrite based on query', async ({ expect }) => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			const pageUrl = `${DEPLOYMENT_URL}/configs-rewrites/some-page?overrideMe=true`;

			await page.goto(pageUrl);

			await assertVisible('h1', {
				hasText: 'This is the "query-somewhere-else" page',
			});

			expect(page.url()).toEqual(pageUrl);
		});

		test('simple rewrite based on header', async ({ expect }) => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			await page.setExtraHTTPHeaders({
				overrideMe: 'true',
			});
			const pageUrl = `${DEPLOYMENT_URL}/configs-rewrites/some-page`;

			await page.goto(pageUrl);

			await assertVisible('h1', {
				hasText: 'This is the "header-somewhere-else" page',
			});

			expect(page.url()).toEqual(pageUrl);
		});
	});

	describe('afterFiles', () => {
		test('static path rewrites not to apply', async ({ expect }) => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			const pageUrl = `${DEPLOYMENT_URL}/configs-rewrites/some-page`;

			await page.goto(pageUrl);

			await assertVisible('h1', { hasText: 'This is the "some-page" page' });

			expect(page.url()).toEqual(pageUrl);
		});

		test('dynamic path rewrite', async ({ expect }) => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			const pageUrl = `${DEPLOYMENT_URL}/configs-rewrites/dynamic/some-dynamic-page`;

			await page.goto(pageUrl);

			await assertVisible('h1', { hasText: 'This is the "some-page" page' });
			await assertVisible('h2', { hasText: 'This page is static' });

			expect(page.url()).toEqual(pageUrl);
		});
	});

	describe('fallbacks', () => {
		test('basic fallback rewrite', async ({ expect }) => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);

			const pageUrl = `${DEPLOYMENT_URL}/configs-rewrites/some-non-existing-page`;

			await page.goto(pageUrl);

			await assertVisible('h1', { hasText: 'This is the "some-page" page' });
			await assertVisible('h2', { hasText: 'This page is static' });

			expect(page.url()).toEqual(pageUrl);
		});
	});
});
