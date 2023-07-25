import { describe, it } from 'vitest';

describe('Simple App Assets', () => {
	it('should return the favicon', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/favicon.ico`);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toMatch(/image\/*/);
	});

	it('should return the Vercel logo svg', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/vercel.svg`);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
		expect(await response.text()).toContain('svg');
	});
});
