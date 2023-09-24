import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('default error page', () => {
	test(`visiting a page that throws results in the default 500 internal server error page`, async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		await page.goto(`${DEPLOYMENT_URL}/500-error`);

		await assertVisible('h1', {
			hasText: '500',
		});

		await assertVisible('h2', {
			hasText: 'Internal Server Error.',
		});
	});
});
