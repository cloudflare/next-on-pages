import { describe, test, expect, vi } from 'vitest';
import { generateFunctionsMap } from '../../../src/buildApplication/generateFunctionsMap';
import mockFs from 'mock-fs';
import type { DirectoryItems } from 'mock-fs/lib/filesystem';
import { join } from 'path';
import { mockPrerenderConfigFile } from '../../_helpers';

describe('generateFunctionsMap', async () => {
	describe('with chunks deduplication disabled should correctly handle', () => {
		test('valid index routes', async () => {
			const { functionsMap } = await generateFunctionsMapFrom({
				'index.func': validFuncDir,
				'index.rsc.func': validFuncDir,
			});

			expect(functionsMap.size).toEqual(3);
			expect(functionsMap.get('/')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index.rsc')).toMatch(/\/index\.rsc\.func\.js$/);
		});

		test('valid nested routes', async () => {
			const { functionsMap } = await generateFunctionsMapFrom({
				api: {
					'hello.func': validFuncDir,
				},
			});

			expect(functionsMap.size).toEqual(1);
			expect(functionsMap.get('/api/hello')).toMatch(/\/api\/hello\.func\.js$/);
		});

		test('valid middlewares (and ignore their potential middleware.js file)', async () => {
			const { functionsMap } = await generateFunctionsMapFrom({
				'middlewarejs.func': {
					'.vc-config.json': JSON.stringify({
						name: 'middleware',
						runtime: 'edge',
						entrypoint: 'middleware.js',
					}),
					'index.js': '',
					'middleware.js': '',
				},
				base: {
					'middleware.func': validFuncDir,
				},
			});

			expect(functionsMap.size).toEqual(2);
			expect(functionsMap.get('/middlewarejs')).toMatch(
				/\/middlewarejs\.func\.js$/
			);
			expect(functionsMap.get('/base/middleware')).toMatch(
				/\/base\/middleware\.func\.js$/
			);
		});
	});

	test('should squash valid routes in route groups', async () => {
		const { functionsMap } = await generateFunctionsMapFrom({
			path: {
				'(group-1)': {
					to: {
						'(group-2)': {
							'page.func': validFuncDir,
						},
					},
				},
			},
		});

		expect(functionsMap.size).toEqual(1);
		expect(functionsMap.get('/path/to/page')).toMatch(
			/\/path\/\(group-1\)\/to\/\(group-2\)\/page\.func\.js$/
		);
	});

	test('should squash invalid root functions', async () => {
		const { invalidFunctions, functionsMap } = await generateFunctionsMapFrom({
			'should-be-valid.func': invalidFuncDir,
			'(is-actually-valid)': {
				'should-be-valid.func': validFuncDir,
			},
		});

		expect(Array.from(invalidFunctions.values())).toEqual([]);
		expect(functionsMap.size).toEqual(1);
		expect(functionsMap.get('/should-be-valid')).toMatch(
			/\(is-actually-valid\)\/should-be-valid\.func\.js$/
		);
	});

	test('should return invalid functions', async () => {
		const { invalidFunctions } = await generateFunctionsMapFrom({
			'index.func': invalidFuncDir,
			'index.rsc.func': invalidFuncDir,
		});

		expect(Array.from(invalidFunctions.values())).toEqual([
			'index.func',
			'index.rsc.func',
		]);
	});

	test('should ignore a generated middleware.js file while also proving a warning', async () => {
		const mockedWarn = vi.spyOn(console, 'warn').mockImplementation(() => null);

		const { invalidFunctions } = await generateFunctionsMapFrom({
			'middlewarejs.func': {
				'.vc-config.json': JSON.stringify({
					name: 'middleware',
					runtime: 'edge',
					entrypoint: 'middleware.js',
				}),
				'middleware.js': '',
			},
		});

		expect(Array.from(invalidFunctions.values())).toEqual([]);
		expect(mockedWarn).toHaveBeenCalledTimes(1);
		expect(mockedWarn).toHaveBeenLastCalledWith(
			expect.stringMatching(/invalid middleware function for middlewarejs.func/)
		);

		mockedWarn.mockRestore();
	});

	describe('prerendered routes should be handled correctly', () => {
		test('succeeds for root-level prerendered index route', async () => {
			const { functionsMap, prerenderedRoutes } =
				await generateFunctionsMapFrom({
					'page.func': validFuncDir,
					'page.rsc.func': validFuncDir,
					'index.func': invalidFuncDir,
					'index.rsc.func': invalidFuncDir,
					'index.prerender-config.json': mockPrerenderConfigFile('index'),
					'index.prerender-fallback.html': '',
					'index.rsc.prerender-config.json':
						mockPrerenderConfigFile('index.rsc'),
					'index.rsc.prerender-fallback.rsc': '',
				});

			expect(functionsMap.size).toEqual(2);
			expect(functionsMap.get('/page')).toMatch(/\/page\.func\.js$/);
			expect(functionsMap.get('/page.rsc')).toMatch(/\/page\.rsc\.func\.js$/);

			expect(prerenderedRoutes.size).toEqual(2);
			expect(prerenderedRoutes.get('/index.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/index', '/'],
			});
			expect(prerenderedRoutes.get('/index.rsc')).toEqual({
				headers: {
					'content-type': 'text/x-component',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
				overrides: [],
			});
		});

		test('succeeds for nested prerendered routes', async () => {
			const { functionsMap, prerenderedRoutes } =
				await generateFunctionsMapFrom({
					'index.func': validFuncDir,
					'index.rsc.func': validFuncDir,
					nested: {
						'foo.func': invalidFuncDir,
						'foo.rsc.func': invalidFuncDir,
						'foo.prerender-config.json': mockPrerenderConfigFile('foo'),
						'foo.prerender-fallback.html': '',
						'foo.rsc.prerender-config.json': mockPrerenderConfigFile('foo.rsc'),
						'foo.rsc.prerender-fallback.rsc': '',
						'bar.func': invalidFuncDir,
						'bar.prerender-config.json': mockPrerenderConfigFile('bar'),
						'bar.prerender-fallback.html': '',
					},
				});

			expect(functionsMap.size).toEqual(3);
			expect(functionsMap.get('/')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index.rsc')).toMatch(/\/index\.rsc\.func\.js$/);

			expect(prerenderedRoutes.size).toEqual(3);
			expect(prerenderedRoutes.get('/nested/foo.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/nested/foo'],
			});
			expect(prerenderedRoutes.get('/nested/foo.rsc')).toEqual({
				headers: {
					'content-type': 'text/x-component',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
				overrides: [],
			});
			expect(prerenderedRoutes.get('/nested/bar.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/nested/bar'],
			});
		});

		test('succeeds for prerendered routes inside route groups', async () => {
			const { functionsMap, prerenderedRoutes } =
				await generateFunctionsMapFrom({
					'index.func': validFuncDir,
					'index.rsc.func': validFuncDir,
					nested: {
						'(route-group)': {
							'foo.func': invalidFuncDir,
							'foo.prerender-config.json': mockPrerenderConfigFile('foo'),
							'foo.prerender-fallback.html': '',
						},
					},
				});

			expect(functionsMap.size).toEqual(3);
			expect(functionsMap.get('/')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index.rsc')).toMatch(/\/index\.rsc\.func\.js$/);

			expect(prerenderedRoutes.size).toEqual(1);
			expect(prerenderedRoutes.get('/nested/(route-group)/foo.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/nested/foo.html', '/nested/foo'],
			});
		});

		test('fails with existing static file', async () => {
			const mockedWarn = vi
				.spyOn(console, 'warn')
				.mockImplementation(() => null);

			const { functionsMap, invalidFunctions, prerenderedRoutes } =
				await generateFunctionsMapFrom(
					{
						'index.func': invalidFuncDir,
						'index.rsc.func': invalidFuncDir,
						'index.prerender-config.json': mockPrerenderConfigFile('index'),
						'index.prerender-fallback.html': '',
						'index.rsc.prerender-config.json':
							mockPrerenderConfigFile('index.rsc'),
						'index.rsc.prerender-fallback.rsc': '',
					},
					{ 'index.rsc': '' }
				);

			expect(functionsMap.size).toEqual(0);

			expect(prerenderedRoutes.size).toEqual(1);
			expect(prerenderedRoutes.get('/index.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/index', '/'],
			});

			expect(invalidFunctions.size).toEqual(1);
			expect(invalidFunctions.has('index.rsc.func')).toEqual(true);

			expect(mockedWarn).toHaveBeenCalledTimes(1);
			expect(mockedWarn).toHaveBeenCalledWith(
				expect.stringMatching(/Prerendered file already exists for index.rsc/)
			);
			mockedWarn.mockRestore();
		});

		test('fails with existing nested static file', async () => {
			const mockedWarn = vi
				.spyOn(console, 'warn')
				.mockImplementation(() => null);

			const { functionsMap, invalidFunctions, prerenderedRoutes } =
				await generateFunctionsMapFrom(
					{
						nested: {
							'page.func': invalidFuncDir,
							'page.rsc.func': invalidFuncDir,
							'page.prerender-config.json': mockPrerenderConfigFile('page'),
							'page.prerender-fallback.html': '',
							'page.rsc.prerender-config.json':
								mockPrerenderConfigFile('page.rsc'),
							'page.rsc.prerender-fallback.rsc': '',
						},
					},
					{ nested: { 'page.rsc': '' } }
				);

			expect(functionsMap.size).toEqual(0);

			expect(prerenderedRoutes.size).toEqual(1);
			expect(prerenderedRoutes.get('/nested/page.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/nested/page'],
			});

			expect(invalidFunctions.size).toEqual(1);
			expect(invalidFunctions.has('nested/page.rsc.func')).toEqual(true);

			expect(mockedWarn).toHaveBeenCalledTimes(1);
			expect(mockedWarn).toHaveBeenCalledWith(
				expect.stringMatching(
					/Prerendered file already exists for nested\/page.rsc/
				)
			);
			mockedWarn.mockRestore();
		});

		test('fails with missing file', async () => {
			const mockedWarn = vi
				.spyOn(console, 'warn')
				.mockImplementation(() => null);

			const { functionsMap, invalidFunctions, prerenderedRoutes } =
				await generateFunctionsMapFrom({
					nested: {
						'index.func': invalidFuncDir,
						'index.rsc.func': invalidFuncDir,
						'index.prerender-config.json': mockPrerenderConfigFile('index'),
						'index.prerender-fallback.html': '',
						'index.rsc.prerender-config.json':
							mockPrerenderConfigFile('index.rsc'),
					},
				});

			expect(functionsMap.size).toEqual(0);

			expect(prerenderedRoutes.size).toEqual(1);
			expect(prerenderedRoutes.get('/nested/index.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/nested/index', '/nested'],
			});

			expect(invalidFunctions.size).toEqual(1);
			expect(invalidFunctions.has('nested/index.rsc.func')).toEqual(true);

			expect(mockedWarn).toHaveBeenCalledTimes(1);
			expect(mockedWarn).toHaveBeenCalledWith(
				expect.stringMatching(
					/Could not find prerendered file for nested\/index.rsc.prerender-fallback.rsc/
				)
			);
			mockedWarn.mockRestore();
		});

		test('fails with invalid config', async () => {
			const mockedWarn = vi
				.spyOn(console, 'warn')
				.mockImplementation(() => null);

			const { functionsMap, invalidFunctions, prerenderedRoutes } =
				await generateFunctionsMapFrom({
					nested: {
						'index.func': invalidFuncDir,
						'index.prerender-config.json': JSON.stringify({
							type: 'Prerender',
							fallback: { type: 'FileFsRef', fsPath: '' },
						}),
						'index.prerender-fallback.html': '',
					},
				});

			expect(functionsMap.size).toEqual(0);
			expect(prerenderedRoutes.size).toEqual(0);

			expect(invalidFunctions.size).toEqual(1);
			expect(invalidFunctions.has('nested/index.func')).toEqual(true);

			expect(mockedWarn).toHaveBeenCalledTimes(1);
			expect(mockedWarn).toHaveBeenCalledWith(
				expect.stringMatching(
					/Invalid prerender config for nested\/index.prerender-config.json/
				)
			);
			mockedWarn.mockRestore();
		});
	});

	// TODO: add tests that also test the functions map with the chunks deduplication enabled
});

const validIndexVcConfigJson = JSON.stringify({
	runtime: 'edge',
	entrypoint: 'index.js',
});

const invalidIndexVcConfigJson = JSON.stringify({
	runtime: 'nodejs',
	entrypoint: 'index.js',
});

const validFuncDir = {
	'.vc-config.json': validIndexVcConfigJson,
	'index.js': '',
};

const invalidFuncDir = {
	'.vc-config.json': invalidIndexVcConfigJson,
	'index.js': '',
};

async function generateFunctionsMapFrom(
	functions: DirectoryItems,
	staticAssets: DirectoryItems = {},
	disableChunksDedup = true
) {
	mockFs({
		'.vercel': {
			output: {
				functions,
				static: staticAssets,
			},
		},
	});
	const result = await generateFunctionsMap(
		join('.vercel', 'output', 'functions'),
		disableChunksDedup
	);
	mockFs.restore();
	return result;
}
