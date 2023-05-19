import { describe, test, expect } from 'vitest';
import { processVercelConfig } from '../../../../src/cli/buildApplication/getVercelConfig';

describe('processVercelConfig', () => {
	test('should process the handler phases correctly', () => {
		const inputtedConfig: VercelConfig = {
			version: 3,
			routes: [
				{ src: '/test-1', dest: '/test-2' },
				{ handle: 'filesystem' },
				{ src: '/test-3', dest: '/test-4' },
				{ handle: 'miss' },
				{ src: '/test-2', dest: '/test-6' },
			],
		};

		expect(processVercelConfig(inputtedConfig)).toEqual({
			version: 3,
			routes: {
				none: [{ src: '/test-1', dest: '/test-2' }],
				filesystem: [{ src: '/test-3', dest: '/test-4' }],
				miss: [{ src: '/test-2', dest: '/test-6' }],
				rewrite: [],
				resource: [],
				hit: [],
				error: [],
			},
		});
	});
});
