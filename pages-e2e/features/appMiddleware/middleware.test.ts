import { getAssertVisible } from '@features-utils/getAssertVisible';
import { describe, test } from 'vitest';

describe('App Middleware', () => {
	test('unmodified api request', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/middleware-test/hello`);
		expect(await response.text()).toBe('Hello middleware-test');
	});

	describe('direct NextResponse responses returned from middleware', () => {
		test('overridden api request', async ({ expect }) => {
			const response = await fetch(
				`${DEPLOYMENT_URL}/api/middleware-test/unreachable`,
			);
			const responseText = await response.text();
			expect(responseText).not.toContain(
				'ERROR: This route should not be reachable!',
			);
			expect(responseText).toContain('The requested api route is unreachable');
		});

		test('overridden api request with response with status >= 400', async ({
			expect,
		}) => {
			const response = await fetch(
				`${DEPLOYMENT_URL}/api/middleware-test/unreachable`,
			);
			const responseText = await response.text();
			expect(responseText).not.toContain(
				'ERROR: This route should not be reachable!',
			);
			expect(responseText).toContain('The requested api route is unreachable');
		});

		test('overridden page request', async ({ expect }) => {
			const response = await fetch(
				`${DEPLOYMENT_URL}/middleware-test/unreachable`,
			);
			const responseText = await response.text();
			expect(responseText).not.toContain(
				'ERROR: This route should not be reachable!',
			);
			expect(responseText).toContain('The requested route is unreachable');
		});

		test('overridden non-existent api request', async ({ expect }) => {
			const response = await fetch(
				`${DEPLOYMENT_URL}/api/middleware-test/non-existent/api`,
			);
			const responseText = await response.text();
			expect(responseText).toContain('The requested api route is non-existent');
		});

		test('overridden non-existent page request', async ({ expect }) => {
			const response = await fetch(
				`${DEPLOYMENT_URL}/middleware-test/non-existent/page`,
			);
			const responseText = await response.text();
			expect(responseText).toContain('The requested route is non-existent');
		});

		test('soft erroring from middleware', async ({ expect }) => {
			const response = await fetch(
				`${DEPLOYMENT_URL}/api/middleware-test/hello?soft-error`,
			);
			expect(await response.text()).toEqual('(Soft) Error from middleware');
			expect(response.status).toBe(418);
		});
	});

	test('rewrite api request', async ({ expect }) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		await page.goto(
			`${DEPLOYMENT_URL}/api/middleware-test/hello?rewrite-to-page`,
		);

		await assertVisible('h1', { hasText: 'Page' });
		expect(page.url()).toEqual(
			`${DEPLOYMENT_URL}/api/middleware-test/hello?rewrite-to-page`,
		);
	});

	test('redirect api request', async ({ expect }) => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		await page.goto(
			`${DEPLOYMENT_URL}/api/middleware-test/hello?redirect-to-page`,
		);

		await assertVisible('h1', { hasText: 'Page' });
		const url = page.url();
		const fixedUrlForLocalTesting = url.replace('localhost', '127.0.0.1');
		expect(fixedUrlForLocalTesting).toEqual(
			`${DEPLOYMENT_URL}/middleware-test/page`,
		);
	});

	test('request headers modification', async ({ expect }) => {
		const page = await BROWSER.newPage();
		page.setExtraHTTPHeaders({
			'original-header-for-testing-a': 'this header should be left untouched',
			'original-header-for-testing-b': 'this header should get overridden',
		});
		const assertVisible = getAssertVisible(page);

		await page.goto(`${DEPLOYMENT_URL}/middleware-test/page?set-headers`);

		await assertVisible('h1', { hasText: 'Page' });
		expect(page.url()).toEqual(
			`${DEPLOYMENT_URL}/middleware-test/page?set-headers`,
		);

		await assertVisible('h1', { hasText: 'Page' });
		await assertVisible('li#header-header-set-from-middleware');
		expect(
			await page.locator('li#header-header-set-from-middleware').textContent(),
		).toBe(
			'header-set-from-middleware: this is a test header added by the middleware',
		);
		await assertVisible('li#header-header-set-from-middleware');
		expect(
			await page
				.locator('li#header-original-header-for-testing-a')
				.textContent(),
		).toBe(
			'original-header-for-testing-a: this header should be left untouched',
		);
		await assertVisible('li#header-header-set-from-middleware');
		expect(
			await page
				.locator('li#header-original-header-for-testing-b')
				.textContent(),
		).toBe(
			'original-header-for-testing-b: this header has been overridden by the middleware',
		);
	});

	test('erroring from middleware', async ({ expect }) => {
		const response = await fetch(
			`${DEPLOYMENT_URL}/api/middleware-test/hello?error`,
		);
		expect(response.status).toBe(500);
	});

	test('json from middleware', async ({ expect }) => {
		const response = await fetch(
			`${DEPLOYMENT_URL}/api/middleware-test/hello?json`,
		);
		expect(await response.json()).toEqual({
			text: 'json response from middleware',
		});
	});
});
