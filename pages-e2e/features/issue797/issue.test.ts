import { getAssertVisible } from '@features-utils/getAssertVisible';
import { describe, expect, test } from 'vitest';

describe('issue-797', () => {
	test('should pass headers set in the middleware along to layouts and pages', async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const pageUrl = `${DEPLOYMENT_URL}/`;
		await page.goto(pageUrl);
		const html = await assertVisible('html');

		const layoutAttrHeaderFromMiddleware = await html.getAttribute(
			'layout-attr-header-from-middleware',
		);

		expect(layoutAttrHeaderFromMiddleware).toEqual(
			'this is a header set by the middleware!',
		);

		const gottenReqHeaderP = await assertVisible(
			'p[data-test-id="header-from-middleware"]',
		);
		expect(await gottenReqHeaderP.innerText()).toEqual(
			'header from middleware: this is a header set by the middleware!',
		);
	});
});
