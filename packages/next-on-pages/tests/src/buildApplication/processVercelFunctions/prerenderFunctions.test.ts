import { describe, test, expect, afterEach } from 'vitest';
import mockFs from 'mock-fs';
import {
	collectFunctionsFrom,
	mockConsole,
	mockPrerenderConfigFile,
	edgeFuncDir,
	prerenderFuncDir,
	getRouteInfo,
} from '../../../_helpers';
import { resolve } from 'path';
import { readdirSync } from 'node:fs';
import { processPrerenderFunctions } from '../../../../src/buildApplication/processVercelFunctions/prerenderFunctions';

const functionsDir = resolve('.vercel/output/functions');
const outputDir = resolve('.vercel/output/static');

describe('processPrerenderFunctions', () => {
	afterEach(() => mockFs.restore());

	test('succeeds for root-level prerendered index route', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				'page.func': edgeFuncDir,
				'page.rsc.func': edgeFuncDir,
				'index.func': prerenderFuncDir,
				'index.rsc.func': prerenderFuncDir,
				'index.prerender-config.json': mockPrerenderConfigFile('index'),
				'index.prerender-fallback.html': '',
				'index.rsc.prerender-config.json': mockPrerenderConfigFile('index.rsc'),
				'index.rsc.prerender-fallback.rsc': '',
			},
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(2);
		expect(getRouteInfo(edgeFunctions, 'page.func')).toEqual({
			path: '/page',
			overrides: [],
		});
		expect(getRouteInfo(edgeFunctions, 'page.rsc.func')).toEqual({
			path: '/page.rsc',
			overrides: [],
		});

		expect(prerenderedFunctions.size).toEqual(2);
		expect(getRouteInfo(prerenderedFunctions, 'index.func')).toEqual({
			path: '/index.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/index', '/'],
		});
		expect(getRouteInfo(prerenderedFunctions, 'index.rsc.func')).toEqual({
			path: '/index.rsc',
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('succeeds for prerendered favicon', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				'page.func': edgeFuncDir,
				'page.rsc.func': edgeFuncDir,
				'favicon.ico.func': prerenderFuncDir,
				'favicon.ico.prerender-config.json': mockPrerenderConfigFile(
					'favicon.ico',
					'body',
				),
				'favicon.ico.prerender-fallback.body': 'favicon.ico',
			},
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(2);
		expect(getRouteInfo(edgeFunctions, 'page.func')).toEqual({
			path: '/page',
			overrides: [],
		});
		expect(getRouteInfo(edgeFunctions, 'page.rsc.func')).toEqual({
			path: '/page.rsc',
			overrides: [],
		});

		expect(prerenderedFunctions.size).toEqual(1);
		expect(getRouteInfo(prerenderedFunctions, 'favicon.ico.func')).toEqual({
			path: '/favicon.ico',
			headers: {
				'content-type': 'image/x-icon',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('succeeds for prerendered json', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				_next: {
					data: {
						'data.json.func': prerenderFuncDir,
						'data.json.prerender-config.json': mockPrerenderConfigFile(
							'data.json',
							'json',
						),
						'data.json.prerender-fallback.json': 'data.json',
					},
				},
				'page.func': edgeFuncDir,
				'page.rsc.func': edgeFuncDir,
			},
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(2);
		expect(getRouteInfo(edgeFunctions, 'page.func')).toEqual({
			path: '/page',
			overrides: [],
		});
		expect(getRouteInfo(edgeFunctions, 'page.rsc.func')).toEqual({
			path: '/page.rsc',
			overrides: [],
		});

		expect(prerenderedFunctions.size).toEqual(1);
		expect(
			getRouteInfo(prerenderedFunctions, '_next/data/data.json.func'),
		).toEqual({
			path: '/_next/data/data.json',
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('succeeds for nested prerendered routes', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				'index.func': edgeFuncDir,
				'index.rsc.func': edgeFuncDir,
				nested: {
					'foo.func': prerenderFuncDir,
					'foo.rsc.func': prerenderFuncDir,
					'foo.prerender-config.json': mockPrerenderConfigFile('foo'),
					'foo.prerender-fallback.html': '',
					'foo.rsc.prerender-config.json': mockPrerenderConfigFile('foo.rsc'),
					'foo.rsc.prerender-fallback.rsc': '',
					'bar.func': prerenderFuncDir,
					'bar.prerender-config.json': mockPrerenderConfigFile('bar'),
					'bar.prerender-fallback.html': '',
				},
			},
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(2);
		expect(getRouteInfo(edgeFunctions, 'index.func')).toEqual({
			path: '/index',
			overrides: ['/'],
		});
		expect(getRouteInfo(edgeFunctions, 'index.rsc.func')).toEqual({
			path: '/index.rsc',
			overrides: [],
		});

		expect(prerenderedFunctions.size).toEqual(3);
		expect(getRouteInfo(prerenderedFunctions, 'nested/foo.func')).toEqual({
			path: '/nested/foo.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/nested/foo'],
		});
		expect(getRouteInfo(prerenderedFunctions, 'nested/foo.rsc.func')).toEqual({
			path: '/nested/foo.rsc',
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});
		expect(getRouteInfo(prerenderedFunctions, 'nested/bar.func')).toEqual({
			path: '/nested/bar.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/nested/bar'],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('succeeds for prerendered routes inside route groups', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				'index.func': edgeFuncDir,
				'index.rsc.func': edgeFuncDir,
				nested: {
					'(route-group)': {
						'page.func': edgeFuncDir,
						'foo.func': prerenderFuncDir,
						'foo.prerender-config.json': mockPrerenderConfigFile('foo'),
						'foo.prerender-fallback.html': '',
					},
				},
			},
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(3);
		expect(getRouteInfo(edgeFunctions, 'index.func')).toEqual({
			path: '/index',
			overrides: ['/'],
		});
		expect(getRouteInfo(edgeFunctions, 'index.rsc.func')).toEqual({
			path: '/index.rsc',
			overrides: [],
		});
		expect(
			getRouteInfo(edgeFunctions, 'nested/(route-group)/page.func'),
		).toEqual({
			path: '/nested/page',
			overrides: [],
		});

		expect(prerenderedFunctions.size).toEqual(1);
		expect(
			getRouteInfo(prerenderedFunctions, 'nested/(route-group)/foo.func'),
		).toEqual({
			path: '/nested/(route-group)/foo.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/nested/foo.html', '/nested/foo'],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('does not overwrite existing static file with same hash', async () => {
		const mockedConsole = mockConsole('warn');

		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				'index.func': prerenderFuncDir,
				'index.rsc.func': prerenderFuncDir,
				'index.prerender-config.json': mockPrerenderConfigFile('index'),
				'index.prerender-fallback.html': '',
				'index.rsc.prerender-config.json': mockPrerenderConfigFile('index.rsc'),
				'index.rsc.prerender-fallback.rsc': '',
			},
			static: { 'index.rsc': '' },
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);

		expect(prerenderedFunctions.size).toEqual(2);
		expect(getRouteInfo(prerenderedFunctions, 'index.func')).toEqual({
			path: '/index.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/index', '/'],
		});
		expect(getRouteInfo(prerenderedFunctions, 'index.rsc.func')).toEqual({
			path: '/index.rsc',
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);

		mockedConsole.expectCalls([]);
		mockedConsole.restore();
	});

	test('overwrites existing static file with different hash', async () => {
		const mockedConsole = mockConsole('warn');

		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				nested: {
					'page.func': prerenderFuncDir,
					'page.rsc.func': prerenderFuncDir,
					'page.prerender-config.json': mockPrerenderConfigFile('page'),
					'page.prerender-fallback.html': '',
					'page.rsc.prerender-config.json': mockPrerenderConfigFile('page.rsc'),
					'page.rsc.prerender-fallback.rsc': '',
				},
			},
			static: { nested: { 'page.rsc': 'different' } },
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);

		expect(prerenderedFunctions.size).toEqual(2);
		expect(getRouteInfo(prerenderedFunctions, 'nested/page.func')).toEqual({
			path: '/nested/page.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/nested/page'],
		});
		expect(getRouteInfo(prerenderedFunctions, 'nested/page.rsc.func')).toEqual({
			path: '/nested/page.rsc',
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);

		mockedConsole.expectCalls([
			/Asset with different hash exists for \/nested\/page\.rsc, overwriting\.\.\./,
		]);
		mockedConsole.restore();
	});

	test('fails with missing file', async () => {
		const mockedConsole = mockConsole('warn');

		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				nested: {
					'index.func': prerenderFuncDir,
					'index.rsc.func': prerenderFuncDir,
					'index.prerender-config.json': mockPrerenderConfigFile('index'),
					'index.prerender-fallback.html': '',
					'index.rsc.prerender-config.json':
						mockPrerenderConfigFile('index.rsc'),
				},
			},
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);

		expect(prerenderedFunctions.size).toEqual(1);
		expect(getRouteInfo(prerenderedFunctions, 'nested/index.func')).toEqual({
			path: '/nested/index.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/nested/index', '/nested'],
		});

		expect(invalidFunctions.size).toEqual(1);
		expect(
			invalidFunctions.has(resolve(functionsDir, 'nested', 'index.rsc.func')),
		).toEqual(true);

		mockedConsole.expectCalls([
			/Could not find prerendered file for \/nested\/index\.rsc\.prerender-fallback\.rsc/,
		]);
		mockedConsole.restore();
	});

	test('fails with invalid config', async () => {
		const mockedConsole = mockConsole('warn');

		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				nested: {
					'index.func': prerenderFuncDir,
					'index.prerender-config.json': JSON.stringify({
						type: 'Prerender',
						fallback: { type: 'FileFsRef', fsPath: '' },
					}),
					'index.prerender-fallback.html': '',
				},
			},
		});

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir,
		});
		restoreFsMock();

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);
		expect(prerenderedFunctions.size).toEqual(0);

		expect(invalidFunctions.size).toEqual(1);
		expect(
			invalidFunctions.has(resolve(functionsDir, 'nested', 'index.func')),
		).toEqual(true);

		mockedConsole.expectCalls([/Invalid prerender config for \/nested\/index/]);
		mockedConsole.restore();
	});

	test('overwrites with custom output dir and existing conflicting index.rsc static file with different hash', async () => {
		const mockedConsoleLog = mockConsole('log');
		const mockedConsoleWarn = mockConsole('warn');

		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom(
			{
				functions: {
					'index.func': prerenderFuncDir,
					'index.rsc.func': prerenderFuncDir,
					'index.prerender-config.json': mockPrerenderConfigFile('index'),
					'index.prerender-fallback.html': '',
					'index.rsc.prerender-config.json':
						mockPrerenderConfigFile('index.rsc'),
					'index.rsc.prerender-fallback.rsc': '',
				},
				static: { 'index.rsc': 'different' },
			},
			{ outputDir: resolve('custom') },
		);

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir: resolve('custom'),
		});

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);

		expect(prerenderedFunctions.size).toEqual(2);
		expect(getRouteInfo(prerenderedFunctions, 'index.func')).toEqual({
			path: '/index.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/index', '/'],
		});
		expect(getRouteInfo(prerenderedFunctions, 'index.rsc.func')).toEqual({
			path: '/index.rsc',
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);

		expect(readdirSync(resolve('custom'))).toEqual(['index.html', 'index.rsc']);
		restoreFsMock();

		mockedConsoleLog.expectCalls([
			/output directory: custom/,
			/Copying 1 static asset/,
		]);
		mockedConsoleWarn.expectCalls([
			/Asset with different hash exists for \/index\.rsc, overwriting\.\.\./,
		]);

		mockedConsoleLog.restore();
		mockedConsoleWarn.restore();
	});

	test('succeeds with custom output dir', async () => {
		const mockedConsole = mockConsole('log');

		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom(
			{
				functions: {
					'page.func': edgeFuncDir,
					'page.rsc.func': edgeFuncDir,
					'index.func': prerenderFuncDir,
					'index.rsc.func': prerenderFuncDir,
					'index.prerender-config.json': mockPrerenderConfigFile('index'),
					'index.prerender-fallback.html': '',
					'index.rsc.prerender-config.json':
						mockPrerenderConfigFile('index.rsc'),
					'index.rsc.prerender-fallback.rsc': '',
				},
			},
			{ outputDir: resolve('custom') },
		);

		await processPrerenderFunctions(collectedFunctions, {
			functionsDir,
			outputDir: resolve('custom'),
		});

		const { edgeFunctions, prerenderedFunctions, invalidFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(2);
		expect(getRouteInfo(edgeFunctions, 'page.func')).toEqual({
			path: '/page',
			overrides: [],
		});
		expect(getRouteInfo(edgeFunctions, 'page.rsc.func')).toEqual({
			path: '/page.rsc',
			overrides: [],
		});

		expect(prerenderedFunctions.size).toEqual(2);
		expect(getRouteInfo(prerenderedFunctions, 'index.func')).toEqual({
			path: '/index.html',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			overrides: ['/index', '/'],
		});
		expect(getRouteInfo(prerenderedFunctions, 'index.rsc.func')).toEqual({
			path: '/index.rsc',
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);

		expect(readdirSync(resolve('custom'))).toEqual(['index.html', 'index.rsc']);
		restoreFsMock();

		mockedConsole.expectCalls([/output directory: custom/]);
		mockedConsole.restore();
	});
});
