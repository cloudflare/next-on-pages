import { describe, it } from 'vitest';

describe('Next.js Edge API Routes', () => {
	it('should return JSON', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/hello`);
		expect(await response.json()).toMatchInlineSnapshot(`
			{
			  "name": "John Doe",
			}
		`);
	});
});
