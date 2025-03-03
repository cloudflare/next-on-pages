import { describe, test } from 'vitest';

describe('issue-945', () => {
	test('that we honor status set in nextjs rewrite', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}?rewrite=1`);
		expect(response.status).toBe(401);
	});

	test('that a new nextresponse sets our custom status', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}`);
		expect(response.status).toBe(403);
	});
});
