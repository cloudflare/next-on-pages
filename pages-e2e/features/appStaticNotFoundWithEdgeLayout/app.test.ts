import { getAssertVisible } from '@features-utils/getAssertVisible';
import { describe, test } from 'vitest';

describe('app static not found with edge layout', () => {
	test('/ should serve the home page (alongside the server side layout content)', async ({
		expect,
	}) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const pageUrl = `${DEPLOYMENT_URL}/`;
		await page.goto(pageUrl);

		await assertVisible('h1', { hasText: 'Home Page' });

		const serverLayoutSpanLocator = await assertVisible('span', {
			hasText: '[server side info]',
		});
		const serverLayoutSpanContent = await serverLayoutSpanLocator.textContent();
		expect(serverLayoutSpanContent).toMatch(
			/\[server side info\] the request's accept header value is: "[^"]*?\*\/\*[^"]*?"/,
		);
	});

	test('/non-existent/page/123 should serve the custom 404 page (alongside the server side layout content)', async ({
		expect,
	}) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const pageUrl = `${DEPLOYMENT_URL}/non-existent/page/123`;
		await page.goto(pageUrl);

		await assertVisible('h1', { hasText: 'Not Found' });
		await assertVisible('h2', {
			hasText: 'The requested page could not be found',
		});

		const serverLayoutSpanLocator = await assertVisible('span', {
			hasText: '[server side info]',
		});
		const serverLayoutSpanContent = await serverLayoutSpanLocator.textContent();
		expect(serverLayoutSpanContent).toMatch(
			/\[server side info\] the request's accept header value is: "[^"]*?\*\/\*[^"]*?"/,
		);
	});
});
