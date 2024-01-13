import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('server-actions', () => {
	test('simple forms using a local KV binding can read and write a value', async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		await page.goto(`${DEPLOYMENT_URL}/server-actions/simple-kv-form`);

		await assertVisible('h1', {
			hasText: 'Server Actions - Simple KV Form',
		});

		// let's always clear the value in case it is already set
		// (for example if this run is a retry run)
		const clearBtn = await assertVisible('button[data-test-id="clear-value"]');
		await clearBtn.click();

		await assertVisible('[data-test-id="kv-value-info"]', {
			hasText: 'No value is set for the key',
		});

		const input = await assertVisible('[data-test-id="form-input"]');
		await input.type('This is a test value!');

		const submitBtn = await assertVisible('button[data-test-id="form-submit"]');
		await submitBtn.click();

		await assertVisible('[data-test-id="kv-value-info"]', {
			hasText: `The key's value is "This is a test value!"`,
		});
	});
});
