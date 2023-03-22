import { describe, test, expect, vi } from 'vitest';
import { getNextConfigs } from '../../src/buildApplication/nextConfigs';

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

describe('getNextConfigs', async () => {
	test('should produce an appropriate configs object', async () => {
		const configs = await getNextConfigs();
		expect(configs.basePath).toEqual('/test');
	});
});
