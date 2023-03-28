import { describe, test, expect, vi } from 'vitest';
import { getNextJsConfigs } from '../../src/buildApplication/nextJsConfigs';

vi.mock('node:fs/promises', async () => {
	return {
		readFile: () =>
			new Promise(resolve =>
				resolve(
					JSON.stringify({
						version: 3,
						basePath: '/test',
					})
				)
			),
	};
});

describe('getNextJsConfigs', async () => {
	test('should produce an appropriate configs object', async () => {
		const configs = await getNextJsConfigs();
		expect(configs.basePath).toEqual('/test');
	});
});
