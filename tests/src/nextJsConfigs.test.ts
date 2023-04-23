import { describe, test, expect } from 'vitest';
import { getNextJsConfigs } from '../../src/buildApplication/nextJsConfigs';
import { join } from 'path';
import mockFs from 'mock-fs';

describe('getNextJsConfigs', async () => {
	test('should produce an appropriate configs object', async () => {
		mockFs({
			[join('.next', 'routes-manifest.json')]: JSON.stringify({
				version: 3,
				basePath: '/test',
			}),
		});
		const configs = await getNextJsConfigs();
		expect(configs.basePath).toEqual('/test');
		mockFs.restore();
	});
});
