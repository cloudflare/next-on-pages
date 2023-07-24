import { describe, test, expect, vi } from 'vitest';
import mockFs from 'mock-fs';
import type { BuildLog } from '../../../src/buildApplication/buildSummary';
import {
	printBuildSummary,
	writeBuildInfo,
} from '../../../src/buildApplication/buildSummary';
import type { ProcessedVercelOutput } from '../../../src/buildApplication/processVercelOutput';
import { nextOnPagesVersion, readJsonFile } from '../../../src/utils';
import type { ProcessedVercelFunctions } from '../../../src/buildApplication/processVercelFunctions';
import type { FunctionInfo } from '../../../src/buildApplication/processVercelFunctions/configs';

describe('buildSummary', () => {
	test('printBuildSummary', () => {
		const mockedConsole = vi
			.spyOn(console, 'log')
			.mockImplementation(() => null);

		const staticAssets = [
			'/static-a',
			'/_next/static-a',
			'/_next/static-b',
			'/_next/static-c',
			'/static-b',
			'/_next/static-d',
		];
		const processedVercelOutput: ProcessedVercelOutput = {
			vercelConfig: {} as ProcessedVercelConfig,
			vercelOutput: new Map<string, BuildOutputFunction>([
				['middleware', { type: 'middleware', entrypoint: 'middleware.js' }],
			]),
		};
		const procesedVercelFunctions: ProcessedVercelFunctions = {
			collectedFunctions: {
				functionsDir: '',
				edgeFunctions: new Map([
					['/middleware', { route: { path: '/middleware' } } as FunctionInfo],
					[
						'/home',
						{
							route: { path: '/home' },
							config: {
								assets: [{ name: 'bundled.txt', path: 'assets/bundled.txt' }],
							},
						} as FunctionInfo,
					],
					['/nested/home', { route: { path: '/nested/home' } } as FunctionInfo],
				]),
				prerenderedFunctions: new Map([
					[
						'/prerendered-a',
						{ route: { path: '/prerendered-a' } } as FunctionInfo,
					],
					[
						'/prerendered-b',
						{ route: { path: '/prerendered-b' } } as FunctionInfo,
					],
					[
						'/prerendered-c',
						{ route: { path: '/prerendered-c' } } as FunctionInfo,
					],
				]),
				invalidFunctions: new Map(),
				ignoredFunctions: new Map(),
			},
			identifiers: {
				entrypointsMap: new Map(),
				identifierMaps: {
					wasm: new Map([['wasm-one', { consumers: ['/home'] }]]),
					manifest: new Map(),
					webpack: new Map(),
				},
			},
		};

		printBuildSummary(
			staticAssets,
			processedVercelOutput,
			procesedVercelFunctions,
		);

		expect(mockedConsole).toHaveBeenCalledTimes(1);
		expect(mockedConsole).lastCalledWith(
			`
			⚡️ Build Summary (@cloudflare/next-on-pages v${nextOnPagesVersion})
			⚡️ 
			⚡️ Middleware Functions (1)
			⚡️   - middleware
			⚡️ 
			⚡️ Edge Function Routes (2)
			⚡️   ┌ /home
			⚡️   └ /nested/home
			⚡️ 
			⚡️ Prerendered Routes (3)
			⚡️   ┌ /prerendered-a
			⚡️   ├ /prerendered-b
			⚡️   └ /prerendered-c
			⚡️ 
			⚡️ Wasm Files (1)
			⚡️   - wasm-one
			⚡️ 
			⚡️ Bundled Assets (1)
			⚡️   - bundled.txt
			⚡️ 
			⚡️ Other Static Assets (6)
			⚡️   ┌ /static-a
			⚡️   ├ /static-b
			⚡️   ├ /_next/static-a
			⚡️   ├ /_next/static-b
			⚡️   └ ... 2 more
			`.replace(/\n\t{3}/g, '\n'),
		);

		mockedConsole.mockRestore();
	});

	test('writeBuildInfo', async () => {
		mockFs({ dist: {} });
		const mockedConsole = vi
			.spyOn(console, 'log')
			.mockImplementation(() => null);

		const staticAssets = ['/static-one', '/static-two'];
		const processedVercelOutput: ProcessedVercelOutput = {
			vercelConfig: {} as ProcessedVercelConfig,
			vercelOutput: new Map<string, BuildOutputFunction>([
				['middleware', { type: 'middleware', entrypoint: 'middleware.js' }],
			]),
		};
		const procesedVercelFunctions: ProcessedVercelFunctions = {
			collectedFunctions: {
				functionsDir: '',
				edgeFunctions: new Map([
					['/middleware', { route: { path: '/middleware' } } as FunctionInfo],
					['/home', { route: { path: '/home' } } as FunctionInfo],
					['/nested/home', { route: { path: '/nested/home' } } as FunctionInfo],
				]),
				prerenderedFunctions: new Map([
					[
						'/prerendered-one',
						{ route: { path: '/prerendered-one' } } as FunctionInfo,
					],
					[
						'/prerendered-two',
						{ route: { path: '/prerendered-two' } } as FunctionInfo,
					],
				]),
				invalidFunctions: new Map([
					[
						'/invalid-node-func',
						{ route: { path: '/invalid-node-func' } } as FunctionInfo,
					],
				]),
				ignoredFunctions: new Map([
					[
						'/ignored-rsc-route',
						{ route: { path: '/ignored-rsc-route' } } as FunctionInfo,
					],
				]),
			},
			identifiers: {
				entrypointsMap: new Map(),
				identifierMaps: {
					wasm: new Map([['wasm-one', { consumers: ['/middleware'] }]]),
					manifest: new Map([
						['__BUILD_MANIFEST', { consumers: ['/home', '/nested/home'] }],
					]),
					webpack: new Map([['872', { consumers: ['/home'] }]]),
				},
			},
		};

		await writeBuildInfo(
			'dist',
			staticAssets,
			processedVercelOutput,
			procesedVercelFunctions,
		);

		expect(mockedConsole).toHaveBeenCalledTimes(1);
		expect(mockedConsole).lastCalledWith(
			expect.stringMatching(/Build log saved to 'dist\/nop-build-log\.json'/),
		);

		const logFile = await readJsonFile<BuildLog>('dist/nop-build-log.json');

		expect(logFile?.outputDir).toEqual('dist');
		expect(logFile?.versions).toEqual({
			'@cloudflare/next-on-pages': nextOnPagesVersion,
		});
		expect(logFile?.buildFiles).toEqual({
			functions: {
				edge: [
					{ route: { path: '/middleware' } },
					{ route: { path: '/home' } },
					{ route: { path: '/nested/home' } },
				],
				ignored: [{ route: { path: '/ignored-rsc-route' } }],
				invalid: [{ route: { path: '/invalid-node-func' } }],
				middleware: ['middleware'],
				prerendered: [
					{ route: { path: '/prerendered-one' } },
					{ route: { path: '/prerendered-two' } },
				],
			},
			staticAssets: ['/static-one', '/static-two'],
			identifiers: {
				manifest: { __BUILD_MANIFEST: { consumers: 2 } },
				wasm: { 'wasm-one': { consumers: 1 } },
				webpack: { '872': { consumers: 1 } },
			},
		});

		mockedConsole.mockRestore();
		mockFs.restore();
	});
});
