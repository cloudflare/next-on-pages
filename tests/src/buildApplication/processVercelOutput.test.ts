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
			vercelOutput: new Map([
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

	test('applies overrides from the config to the outputted functions', () => {
		const inputtedConfig: VercelConfig = {
			version: 3,
			routes: [],
			overrides: {
				'404.html': { path: '404', contentType: 'text/html; charset=utf-8' },
				'500.html': { path: '500', contentType: 'text/html; charset=utf-8' },
				'index.html': {
					path: 'index',
					contentType: 'text/html; charset=utf-8',
				},
			},
		};

		const processed = processVercelOutput(
			inputtedConfig,
			['/404.html', '/500.html', '/index.html', '/test.html'],
			{
				hydratedMiddleware: new Map([]),
				hydratedFunctions: new Map([
					['/page', { filepath: '/page/index.js', matchers: [] }],
				]),
			}
		);

		expect(processed).toEqual({
			vercelConfig: {
				version: 3,
				routes: {
					none: [],
					filesystem: [],
					miss: [],
					rewrite: [],
					resource: [],
					hit: [],
					error: [],
				},
				overrides: {
					'404.html': {
						contentType: 'text/html; charset=utf-8',
						path: '404',
					},
					'500.html': {
						contentType: 'text/html; charset=utf-8',
						path: '500',
					},
					'index.html': {
						contentType: 'text/html; charset=utf-8',
						path: 'index',
					},
				},
			},
			vercelOutput: new Map([
				[
					'/404.html',
					{
						contentType: 'text/html; charset=utf-8',
						path: '/404.html',
						type: 'override',
					},
				],
				[
					'/500.html',
					{
						contentType: 'text/html; charset=utf-8',
						path: '/500.html',
						type: 'override',
					},
				],
				[
					'/index.html',
					{
						contentType: 'text/html; charset=utf-8',
						path: '/index.html',
						type: 'override',
					},
				],
				[
					'/test.html',
					{
						type: 'static',
					},
				],
				[
					'/page',
					{
						entrypoint: '/page/index.js',
						matchers: [],
						type: 'function',
					},
				],
				[
					'/404',
					{
						contentType: 'text/html; charset=utf-8',
						path: '/404.html',
						type: 'override',
					},
				],
				[
					'/500',
					{
						contentType: 'text/html; charset=utf-8',
						path: '/500.html',
						type: 'override',
					},
				],
				[
					'/index',
					{
						contentType: 'text/html; charset=utf-8',
						path: '/index.html',
						type: 'override',
					},
				],
				[
					'/',
					{
						contentType: 'text/html; charset=utf-8',
						path: '/index.html',
						type: 'override',
					},
				],
			]),
		});
	});
});
