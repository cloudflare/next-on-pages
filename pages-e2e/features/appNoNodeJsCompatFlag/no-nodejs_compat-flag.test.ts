import { getAssertVisible } from '@features-utils/getAssertVisible';
import { describe, test } from 'vitest';

describe('no nodejs_compatibility flag set', () => {
	test('a request to the route of the application returns an actionable static error page', async ({
		expect,
	}) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		const pageUrl = `${DEPLOYMENT_URL}/`;

		await page.goto(pageUrl);

		await assertVisible('.error', { hasText: 'Node.JS Compatibility Error' });

		await assertVisible('.what-can-i-do > h2', { hasText: 'What can I do?' });

		expect(page.url()).toEqual(pageUrl);
	});

	test('a request to any sub-route of the application returns an actionable static error page', async ({
		expect,
	}) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		const pageUrl = `${DEPLOYMENT_URL}/non-existing-route`;

		await page.goto(pageUrl);

		await assertVisible('.error', { hasText: 'Node.JS Compatibility Error' });

		await assertVisible('.what-can-i-do > h2', { hasText: 'What can I do?' });

		expect(page.url()).toEqual(pageUrl);
	});
});
