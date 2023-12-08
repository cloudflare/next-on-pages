import { getAssertVisible } from '@features-utils/getAssertVisible';
import { describe, test } from 'vitest';

describe('issue-578', () => {
	test('navigating to /api/hello should return a Hello world response', async ({
		expect,
	}) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/hello`);
		expect(await response.text()).toBe('Hello world');
	});

	test('/ should display the catch-all page', async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const pageUrl = `${DEPLOYMENT_URL}/`;
		await page.goto(pageUrl);
		await assertVisible('h1', { hasText: '[[...path]].tsx Page' });
	});

	test('/a/random/path should display the catch-all page', async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const pageUrl = `${DEPLOYMENT_URL}/a/random/path`;
		await page.goto(pageUrl);
		await assertVisible('h1', { hasText: '[[...path]].tsx Page' });
	});

	test('static assets should be correctly served', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/next.svg`);
		expect(await response.text()).toMatch(
			/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" fill="none" viewBox="0 0 394 80">.*<\/svg>/,
		);
	});
});
