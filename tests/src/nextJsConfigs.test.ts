import { describe, test, expect } from 'vitest';
import { getNextJsConfigs } from '../../src/buildApplication/nextJsConfigs';

describe('getNextJsConfigs', async () => {
	test('should produce an appropriate configs object', async () => {
		const configs = await getNextJsConfigs();
		expect(configs.basePath).toEqual('/test');
	});
});
