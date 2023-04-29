import { describe, test, expect } from 'vitest';
import type { ProcessedVercelOutput } from '../../../src/buildApplication/processVercelOutput';
import { processVercelOutput } from '../../../src/buildApplication/processVercelOutput';
import type { PrerenderedFileData } from '../../../src/buildApplication/fixPrerenderedRoutes';

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
		const inputtedAssets = ['/static/test.png'];
		const inputtedPrerendered = new Map<string, PrerenderedFileData>();
		const inputtedFunctions = new Map<string, string>([
			['/middleware', '/middleware/index.js'],
			['/use-middleware', '/use-middleware/index.js'],
		]);

		const processed = processVercelOutput(
			inputtedConfig,
			inputtedAssets,
			inputtedPrerendered,
			inputtedFunctions
		);

		const expected: ProcessedVercelOutput = {
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
						type: 'function',
					},
				],
				[
					'middleware',
					{
						entrypoint: '/middleware/index.js',
						type: 'middleware',
					},
				],
			]),
		};

		expect(processed).toEqual(expected);
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
		const inputtedAssets = [
			'/404.html',
			'/500.html',
			'/index.html',
			'/test.html',
		];
		const inputtedPrerendered = new Map<string, PrerenderedFileData>();
		const inputtedFunctions = new Map<string, string>([
			['/page', '/page/index.js'],
		]);

		const processed = processVercelOutput(
			inputtedConfig,
			inputtedAssets,
			inputtedPrerendered,
			inputtedFunctions
		);

		const expected: ProcessedVercelOutput = {
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
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/404.html',
						type: 'override',
					},
				],
				[
					'/500.html',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/500.html',
						type: 'override',
					},
				],
				[
					'/index.html',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
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
						type: 'function',
					},
				],
				[
					'/404',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/404.html',
						type: 'override',
					},
				],
				[
					'/500',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/500.html',
						type: 'override',
					},
				],
				[
					'/index',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/index.html',
						type: 'override',
					},
				],
				[
					'/',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/index.html',
						type: 'override',
					},
				],
			]),
		};

		expect(processed).toEqual(expected);
	});

	test('applies prerendered routes to the outputted functions', () => {
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
		const inputtedAssets = [
			'/404.html',
			'/500.html',
			'/index.html',
			'/index.rsc',
			'/nested/(route-group)/foo.html',
		];
		const inputtedPrerendered = new Map<string, PrerenderedFileData>([
			[
				'/index.html',
				{
					headers: {
						vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
					},
					overrides: ['/index', '/'],
				},
			],
			[
				'/index.rsc',
				{
					headers: {
						'content-type': 'text/x-component',
						vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
					},
					overrides: [],
				},
			],
			[
				'/nested/(route-group)/foo.html',
				{
					headers: {
						vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
					},
					overrides: ['/nested/foo.html', '/nested/foo'],
				},
			],
		]);
		const inputtedFunctions = new Map<string, string>([
			['/page', '/page/index.js'],
		]);

		const processed = processVercelOutput(
			inputtedConfig,
			inputtedAssets,
			inputtedPrerendered,
			inputtedFunctions
		);

		const expected: ProcessedVercelOutput = {
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
			vercelOutput: new Map<string, BuildOutputItem>([
				[
					'/404.html',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/404.html',
						type: 'override',
					},
				],
				[
					'/500.html',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/500.html',
						type: 'override',
					},
				],
				[
					'/index.html',
					{
						headers: {
							vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
						},
						path: '/index.html',
						type: 'override',
					},
				],
				[
					'/index.rsc',
					{
						headers: {
							'content-type': 'text/x-component',
							vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
						},
						path: '/index.rsc',
						type: 'override',
					},
				],
				[
					'/nested/(route-group)/foo.html',
					{
						headers: {
							vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
						},
						path: '/nested/(route-group)/foo.html',
						type: 'override',
					},
				],
				[
					'/page',
					{
						entrypoint: '/page/index.js',
						type: 'function',
					},
				],
				[
					'/404',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/404.html',
						type: 'override',
					},
				],
				[
					'/500',
					{
						headers: { 'content-type': 'text/html; charset=utf-8' },
						path: '/500.html',
						type: 'override',
					},
				],
				[
					'/index',
					{
						headers: {
							vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
						},
						path: '/index.html',
						type: 'override',
					},
				],
				[
					'/',
					{
						headers: {
							vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
						},
						path: '/index.html',
						type: 'override',
					},
				],
				[
					'/nested/foo.html',
					{
						headers: {
							vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
						},
						path: '/nested/(route-group)/foo.html',
						type: 'override',
					},
				],
				[
					'/nested/foo',
					{
						headers: {
							vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
						},
						path: '/nested/(route-group)/foo.html',
						type: 'override',
					},
				],
			]),
		};

		expect(processed).toEqual(expected);
	});
});
