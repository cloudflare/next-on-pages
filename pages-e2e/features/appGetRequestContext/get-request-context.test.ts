import { describe, test } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

describe('getRequestContext', () => {
	test('works in server components', async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);

		await page.goto(`${DEPLOYMENT_URL}/get-request-context`);

		await assertVisible('h1', {
			hasText: 'Server Component',
		});

		await assertVisible('[data-test-id="my-toml-var"]', {
			hasText: "MY_TOML_VAR = 'my var from wrangler.toml'",
		});

		await assertVisible('[data-test-id="kv-value"]', {
			hasText: "the KV value is 'kv-value'",
		});

		await assertVisible('[data-test-id="typeof-wait-until"]', {
			hasText: "typeof ctx.waitUntil = 'function'",
		});

		await assertVisible('[data-test-id="typeof-cf-colo"]', {
			hasText: "typeof cf.colo = 'string'",
		});
	});

	test('works in api routes', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/get-request-context`);
		expect(await response.json()).toEqual({
			kvValue: 'kv-value',
			myTomlVar: 'my var from wrangler.toml',
			typeofWaitUntil: 'function',
			typeofCfColo: 'string',
		});
	});
});
