import { describe, it } from 'vitest';

describe('Simple App server API route with fetch caching', () => {
	it('should return a cached fetch response from the suspense cache', async ({
		expect,
	}) => {
		const initialResp = await fetch(`${DEPLOYMENT_URL}/api/cache`);
		const initialRespJson = await initialResp.json();

		expect(initialRespJson.body).toEqual(expect.stringMatching('Hello world'));
		expect(initialRespJson.headers).toEqual(
			expect.not.objectContaining({ 'cf-next-suspense-cache': 'HIT' }),
		);

		// artificial delay to ensure cache entry updates
		await new Promise(res => setTimeout(res, 3000));

		const cachedResp = await fetch(`${DEPLOYMENT_URL}/api/cache`);
		const cachedRespJson = await cachedResp.json();

		expect(cachedRespJson.body).toEqual(expect.stringMatching('Hello world'));
		expect(cachedRespJson.headers).toEqual(
			expect.objectContaining({ 'cf-next-suspense-cache': 'HIT' }),
		);
	});
});
