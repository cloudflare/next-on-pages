import { describe, test, expect } from 'vitest';
import { processVercelOutput } from '../../../src/buildApplication/processVercelOutput';

describe('processVercelOutput', () => {
	test('should process the config and build output correctly', () => {
		const inputtedConfig: VercelConfig = {
			version: 3,
			routes: [
				{ src: '/test-1', dest: '/test-2' },
				{ src: '/use-middleware', middlewarePath: 'middleware' },
				{ handle: 'filesystem' },
				{ src: '/test-3', dest: '/test-4' },
				{ handle: 'miss' },
				{ src: '/test-2', dest: '/test-6' },
			],
		};

		const processed = processVercelOutput(
			inputtedConfig,
			['/static/test.png'],
			{
				hydratedMiddleware: new Map([
					['/middleware', { filepath: '/middleware/index.js', matchers: [] }],
				]),
				hydratedFunctions: new Map([
					[
						'/use-middleware',
						{ filepath: '/use-middleware/index.js', matchers: [] },
					],
				]),
			}
		);

		expect(processed).toEqual({
			vercelConfig: {
				version: 3,
				routes: {
					none: [
						{ src: '/test-1', dest: '/test-2' },
						{ src: '/use-middleware', middlewarePath: 'middleware' },
					],
					filesystem: [{ src: '/test-3', dest: '/test-4' }],
					miss: [{ src: '/test-2', dest: '/test-6' }],
					rewrite: [],
					resource: [],
					hit: [],
					error: [],
				},
			},
			functionsMap: new Map([
				['/static/test.png', { type: 'static' }],
				[
					'/use-middleware',
					{
						entrypoint: '/use-middleware/index.js',
						matchers: [],
						type: 'function',
					},
				],
				[
					'middleware',
					{
						entrypoint: '/middleware/index.js',
						matchers: [],
						type: 'middleware',
					},
				],
			]),
		});
	});
});
