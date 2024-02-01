import { describe, test } from 'vitest';

describe('next.config.mjs Headers', () => {
	test('addition of headers to api response', async ({ expect }) => {
		const response = await fetch(
			`${DEPLOYMENT_URL}/api/configs-headers/to-apply/some-route`,
		);
		expect(await response.text()).toBe(
			'api/configs-headers/to-apply/some-route route',
		);
		expect(response.headers.get('x-custom-configs-header')).toEqual(
			'my custom header value (from next.config.mjs)',
		);
		expect(response.headers.get('x-another-custom-configs-header')).toEqual(
			'my other custom header value (from next.config.mjs)',
		);
	});

	test('no addition of headers to api response', async ({ expect }) => {
		const response = await fetch(
			`${DEPLOYMENT_URL}/api/configs-headers/not-to-apply/some-route`,
		);
		expect(await response.text()).toBe(
			'api/configs-headers/not-to-apply/some-route route',
		);
		expect(response.headers.get('x-custom-configs-header')).toBe(null);
		expect(response.headers.get('x-another-custom-configs-header')).toBe(null);
	});
});
