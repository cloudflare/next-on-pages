import { getAssertVisible } from '@features-utils/getAssertVisible';
import { describe, test } from 'vitest';

describe('issue-593', () => {
	test('navigating to /api/hello should return a Hello world response', async ({
		expect,
	}) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/hello`);
		expect(await response.json()).toEqual({
			text: 'Hello world!',
		});
	});

	test('/some-random-route should display the catch-all page', async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const pageUrl = `${DEPLOYMENT_URL}/some-random-route`;
		await page.goto(pageUrl);
		await assertVisible('h1', { hasText: 'catch-all route' });
	});

	test('/ should display the home page', async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const pageUrl = `${DEPLOYMENT_URL}/`;
		await page.goto(pageUrl);
		await assertVisible('h1', { hasText: 'home page' });
	});
});
