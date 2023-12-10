import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('App Wasm', () => {
	test(`wasm modules should work as expected`, async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		await page.goto(`${DEPLOYMENT_URL}/wasm/add-one`);

		await assertVisible('h1', {
			hasText: 'WASM says that 4 + 1 = 5',
		});
	});
});
