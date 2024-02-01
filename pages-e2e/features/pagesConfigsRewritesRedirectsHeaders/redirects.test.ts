import { describe, test } from 'vitest';

describe('next.config.mjs Redirects', () => {
	test('basic non-permanent redirects', async ({ expect }) => {
		const response = await fetch(
			`${DEPLOYMENT_URL}/permanent-config-redirect`,
			{ redirect: 'manual' },
		);
		expect(response.status).toBe(308);
		expect(response.headers.get('location')).toMatch(
			/\/permanent-config-redirect-destination$/,
		);
	});

	test('basic permanent redirects', async ({ expect }) => {
		const response = await fetch(
			`${DEPLOYMENT_URL}/non-permanent-config-redirect`,
			{ redirect: 'manual' },
		);
		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toMatch(
			/\/non-permanent-config-redirect-destination$/,
		);
	});
});
