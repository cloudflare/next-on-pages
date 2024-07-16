import { describe, test } from 'vitest';

describe('Custom Entrypoint', () => {
	test('should set header on response in the worker entrypoint', async ({
		expect,
	}) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/hello`);

		await expect(response.text()).resolves.toEqual('Hello world');
		expect(response.headers.get('custom-entrypoint')).toEqual('1');
	});
});
