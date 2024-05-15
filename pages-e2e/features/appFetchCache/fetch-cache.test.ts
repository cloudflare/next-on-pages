import { beforeAll, describe, it } from 'vitest';

describe('Simple Pages API Routes', () => {
	it('should return a cached fetch response from the suspense cache', async ({
		expect,
	}) => {
		const initialResp = await fetch(`${DEPLOYMENT_URL}/api/cache`);
		const initialRespJson = await initialResp.json();

		expect(initialRespJson.body).toEqual(expect.stringMatching('Hello world'));
		expect(initialRespJson.headers).toEqual(
			expect.not.objectContaining({ 'cf-next-suspense-cache': 'HIT' }),
		);

		const cachedResp = await fetch(`${DEPLOYMENT_URL}/api/cache`);
		const cachedRespJson = await cachedResp.json();

		expect(cachedRespJson.body).toEqual(expect.stringMatching('Hello world'));
		expect(cachedRespJson.headers).toEqual(
			expect.objectContaining({ 'cf-next-suspense-cache': 'HIT' }),
		);
	});
});
