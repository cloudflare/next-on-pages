import { describe, it } from 'vitest';

describe('Simple Pages Static Routes', () => {
	it('should view the Vercel Logo present in the default static index page', async ({
		expect,
	}) => {
		const page = await BROWSER.newPage();
		await page.goto(`${DEPLOYMENT_URL}`);

		const nextLogoIsVisible = await page
			.locator('img[alt="Vercel Logo"]')
			.isVisible();
		expect(nextLogoIsVisible).toBe(true);
	});

	it('should apply the correct css styling to the static index page', async ({
		expect,
	}) => {
		const page = await BROWSER.newPage();
		await page.goto(`${DEPLOYMENT_URL}`);

		const bodyElement = await page.waitForSelector('body');

		const pageContent = await page.content();

		const isOldStyleNextIndexPage = pageContent.includes(
			'Welcome to <a href="https://nextjs.org">Next.js!</a>',
		);

		if (isOldStyleNextIndexPage) {
			const bodyFontFamily = await bodyElement.evaluate(el => {
				return window.getComputedStyle(el).getPropertyValue('font-family');
			});
			expect(bodyFontFamily).toContain('Droid Sans');
		} else {
			const bodyBackground = await bodyElement.evaluate(el => {
				return window.getComputedStyle(el).getPropertyValue('background');
			});
			expect(bodyBackground).toContain('linear-gradient');
		}
	});

	it('should return a user defined static page', async ({ expect }) => {
		const page = await BROWSER.newPage();
		await page.goto(`${DEPLOYMENT_URL}/staticRouteA`);

		const h1Text = await page.locator('h1').textContent();
		expect(h1Text).toContain('This is a static route');
	});
});
