import { describe, test } from 'vitest';

describe('default trailing slashes redirection', () => {
	test(`fetching without an added trailing slash results in a redirected response`, async ({
		expect,
	}) => {
		const response = await fetch(
			`${DEPLOYMENT_URL}/api/routing-trailing-slash-test`,
		);

		expect(response.redirected).toBe(true);
		expect(response.status).toBe(200);
		expect(response.url).toEqual(
			`${DEPLOYMENT_URL}/api/routing-trailing-slash-test/`,
		);
	});
});
