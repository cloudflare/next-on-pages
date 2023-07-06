import { describe, it } from 'vitest';

describe('Simple Pages API Routes', () => {
	it('should return Hello world response', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/hello`);
		expect(await response.text()).toBe('Hello world');
	});
});
