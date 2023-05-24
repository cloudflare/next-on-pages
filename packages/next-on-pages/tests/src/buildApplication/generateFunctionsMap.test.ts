import { describe, test, expect, vi, afterEach } from 'vitest';
import { generateFunctionsMap } from '../../../src/buildApplication/generateFunctionsMap';
import mockFs from 'mock-fs';
import type { DirectoryItems } from 'mock-fs/lib/filesystem';
import { resolve } from 'path';
import { mockConsole, mockPrerenderConfigFile } from '../../_helpers';
import { writeFile } from 'fs/promises';
import {
	getVercelStaticAssets,
	setupOutputDir,
} from '../../../src/buildApplication/processVercelOutput';
import { readdirSync } from 'fs';

function getEsBuildMock() {
	const esbuildMock = {
		build: (options: { stdin?: { contents: string }; outfile: string }) => {
			const contents = options.stdin?.contents ?? 'built code';
			writeFile(options.outfile, contents);
		},
	};
	return esbuildMock;
}

vi.mock('esbuild', async () => getEsBuildMock());

describe('generateFunctionsMap', async () => {
	afterEach(() => mockFs.restore());
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
		const mockedConsole = mockConsole('warn');

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

		mockedConsole.expectCalls([
			/invalid middleware function for middlewarejs\.func/,
		]);
		mockedConsole.restore();
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

		test('succeeds for prerendered favicon', async () => {
			const { functionsMap, prerenderedRoutes } =
				await generateFunctionsMapFrom({
					'page.func': validFuncDir,
					'page.rsc.func': validFuncDir,
					'favicon.ico.func': invalidFuncDir,
					'favicon.ico.prerender-config.json': mockPrerenderConfigFile(
						'favicon.ico',
						'body'
					),
					'favicon.ico.prerender-fallback.body': 'favicon.ico',
				});

			expect(functionsMap.size).toEqual(2);
			expect(functionsMap.get('/page')).toMatch(/\/page\.func\.js$/);
			expect(functionsMap.get('/page.rsc')).toMatch(/\/page\.rsc\.func\.js$/);

			expect(prerenderedRoutes.size).toEqual(1);
			expect(prerenderedRoutes.get('/favicon.ico')).toEqual({
				headers: {
					'content-type': 'image/x-icon',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
				overrides: [],
			});
		});

		test('succeeds for prerendered json', async () => {
			const { functionsMap, prerenderedRoutes } =
				await generateFunctionsMapFrom({
					_next: {
						data: {
							'data.json.func': invalidFuncDir,
							'data.json.prerender-config.json': mockPrerenderConfigFile(
								'data.json',
								'json'
							),
							'data.json.prerender-fallback.json': 'data.json',
						},
					},
					'page.func': validFuncDir,
					'page.rsc.func': validFuncDir,
				});

			expect(functionsMap.size).toEqual(2);
			expect(functionsMap.get('/page')).toMatch(/\/page\.func\.js$/);
			expect(functionsMap.get('/page.rsc')).toMatch(/\/page\.rsc\.func\.js$/);

			expect(prerenderedRoutes.size).toEqual(1);
			expect(prerenderedRoutes.get('/_next/data/data.json')).toEqual({
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

		test('overwrites existing static file', async () => {
			const mockedConsole = mockConsole('warn');

			const { functionsMap, prerenderedRoutes } =
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

			mockedConsole.expectCalls([
				/Prerendered file already exists for index\.rsc, overwriting\.\.\./,
			]);
			mockedConsole.restore();
		});

		test('overwrites existing nested static file', async () => {
			const mockedConsole = mockConsole('warn');

			const { functionsMap, prerenderedRoutes } =
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

			expect(prerenderedRoutes.size).toEqual(2);
			expect(prerenderedRoutes.get('/nested/page.html')).toEqual({
				headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
				overrides: ['/nested/page'],
			});
			expect(prerenderedRoutes.get('/nested/page.rsc')).toEqual({
				headers: {
					'content-type': 'text/x-component',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
				overrides: [],
			});

			mockedConsole.expectCalls([
				/Prerendered file already exists for nested\/page\.rsc, overwriting\.\.\./,
			]);
			mockedConsole.restore();
		});

		test('fails with missing file', async () => {
			const mockedConsole = mockConsole('warn');

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

			mockedConsole.expectCalls([
				/Could not find prerendered file for nested\/index\.rsc\.prerender-fallback\.rsc/,
			]);
			mockedConsole.restore();
		});

		test('fails with invalid config', async () => {
			const mockedConsole = mockConsole('warn');

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

			mockedConsole.expectCalls([
				/Invalid prerender config for nested\/index\.prerender-config\.json/,
			]);
			mockedConsole.restore();
		});

		test('fails with custom output dir and existing conflicting index.rsc static file', async () => {
			const mockedConsoleLog = mockConsole('log');
			const mockedConsoleWarn = mockConsole('warn');

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
					{ 'index.rsc': '' },
					true,
					resolve('custom')
				);

			expect(functionsMap.size).toEqual(0);

			expect(prerenderedRoutes.size).toEqual(1);
			expect(prerenderedRoutes.has('/index.html')).toEqual(true);

			expect(invalidFunctions.size).toEqual(1);
			expect(invalidFunctions.has('index.rsc.func')).toEqual(true);

			expect(readdirSync(resolve('custom'))).toEqual([
				'index.html',
				'index.rsc',
			]);

			mockedConsoleLog.expectCalls([
				/output directory: custom/,
				/Copying 1 static asset/,
			]);
			mockedConsoleWarn.expectCalls([
				/Prerendered file already exists for index\.rsc/,
			]);

			mockedConsoleLog.restore();
			mockedConsoleWarn.restore();
		});

		test('succeeds with custom output dir', async () => {
			const mockedConsole = mockConsole('log');

			const { functionsMap, prerenderedRoutes } =
				await generateFunctionsMapFrom(
					{
						'page.func': validFuncDir,
						'page.rsc.func': validFuncDir,
						'index.func': invalidFuncDir,
						'index.rsc.func': invalidFuncDir,
						'index.prerender-config.json': mockPrerenderConfigFile('index'),
						'index.prerender-fallback.html': '',
						'index.rsc.prerender-config.json':
							mockPrerenderConfigFile('index.rsc'),
						'index.rsc.prerender-fallback.rsc': '',
					},
					{},
					true,
					resolve('custom')
				);

			expect(functionsMap.size).toEqual(2);
			expect(functionsMap.get('/page')).toMatch(/\/page\.func\.js$/);
			expect(functionsMap.get('/page.rsc')).toMatch(/\/page\.rsc\.func\.js$/);

			expect(prerenderedRoutes.size).toEqual(2);
			expect(prerenderedRoutes.has('/index.html')).toEqual(true);
			expect(prerenderedRoutes.has('/index.rsc')).toEqual(true);

			expect(readdirSync(resolve('custom'))).toEqual([
				'_worker.js',
				'index.html',
				'index.rsc',
			]);

			mockedConsole.expectCalls([/output directory: custom/]);
			mockedConsole.restore();
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
	disableChunksDedup = true,
	outputDir = resolve('.vercel', 'output', 'static'),
	otherDirs: DirectoryItems = {}
) {
	mockFs({
		'.vercel': {
			output: {
				functions,
				static: staticAssets,
			},
		},
		...otherDirs,
	});

	await setupOutputDir(outputDir, await getVercelStaticAssets());
	const result = await generateFunctionsMap(
		resolve('.vercel', 'output', 'functions'),
		outputDir,
		disableChunksDedup
	);
	return result;
}
