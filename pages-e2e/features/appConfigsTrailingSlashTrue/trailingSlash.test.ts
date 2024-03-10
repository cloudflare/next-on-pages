import { describe, test } from 'vitest';

describe('default trailing slashes redirection', () => {
	describe('fetching without an added trailing slash results in a redirected response', () => {
		test('the user gets the requested page', async ({ expect }) => {
			const response = await fetch(
				`${DEPLOYMENT_URL}/api/routing-trailing-slash-test`,
			);

			expect(response.redirected).toBe(true);
			expect(response.status).toBe(200);
			expect(response.url).toEqual(
				`${DEPLOYMENT_URL}/api/routing-trailing-slash-test/`,
			);
		});

		test('the response is actually a redirect (and not a rewrite)', async ({
			expect,
		}) => {
			const err = await fetch(
				`${DEPLOYMENT_URL}/api/routing-trailing-slash-test`,
				{ redirect: 'error' },
			)
				.then(() => null)
				.catch(e => e.cause.message);

			expect(err).toEqual('unexpected redirect');
		});
	});
});
