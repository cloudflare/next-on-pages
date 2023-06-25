import { describe, test, expect, vi } from 'vitest';
import mockFs from 'mock-fs';
import type { BuildLog } from '../../../src/buildApplication/buildSummary';
import {
	printBuildSummary,
	writeBuildInfo,
} from '../../../src/buildApplication/buildSummary';
import type { ProcessedVercelOutput } from '../../../src/buildApplication/processVercelOutput';
import type { DirectoryProcessingResults } from '../../../src/buildApplication/generateFunctionsMap';
import { nextOnPagesVersion, readJsonFile } from '../../../src/utils';

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
		const directoryProcessingResults: Partial<DirectoryProcessingResults> = {
			functionsMap: new Map([
				['/middleware', '/middleware'],
				['/home', '/home'],
				['/nested/home', '/nested/home'],
			]),
			prerenderedRoutes: new Map([
				['/prerendered-a', {}],
				['/prerendered-b', {}],
				['/prerendered-c', {}],
			]),
			wasmIdentifiers: new Map([
				[
					'wasm-one',
					{
						identifier: 'wasm-one',
						importPath: '/wasm/wasm-one.wasm',
						originalFileLocation: '/assets/wasm/wasm-one.wasm',
					},
				],
			]),
		};

		printBuildSummary(
			staticAssets,
			processedVercelOutput,
			directoryProcessingResults
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
			⚡️ Other Static Assets (6)
			⚡️   ┌ /static-a
			⚡️   ├ /static-b
			⚡️   ├ /_next/static-a
			⚡️   ├ /_next/static-b
			⚡️   └ ... 2 more
			`.replace(/\n\t{3}/g, '\n')
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
		const directoryProcessingResults: Partial<DirectoryProcessingResults> = {
			functionsMap: new Map([
				['/middleware', '/middleware'],
				['/home', '/home'],
				['/nested/home', '/nested/home'],
			]),
			prerenderedRoutes: new Map([
				['/prerendered-one', {}],
				['/prerendered-two', {}],
			]),
			wasmIdentifiers: new Map([
				[
					'wasm-one',
					{
						identifier: 'wasm-one',
						importPath: '/wasm/wasm-one.wasm',
						originalFileLocation: '/assets/wasm/wasm-one.wasm',
					},
				],
			]),
		};

		await writeBuildInfo(
			'dist',
			staticAssets,
			processedVercelOutput,
			directoryProcessingResults
		);

		expect(mockedConsole).toHaveBeenCalledTimes(1);
		expect(mockedConsole).lastCalledWith(
			expect.stringMatching(/Build log saved to 'dist\/nop-build-log\.json'/)
		);

		const logFile = await readJsonFile<BuildLog>('dist/nop-build-log.json');

		expect(logFile?.outputDir).toEqual('dist');
		expect(logFile?.versions).toEqual({
			'@cloudflare/next-on-pages': nextOnPagesVersion,
		});
		expect(logFile?.buildFiles).toEqual({
			edgeFunctions: ['/middleware', '/home', '/nested/home'],
			invalidFunctions: [],
			middlewareFunctions: ['middleware'],
			prerenderFunctionFallbackFiles: ['/prerendered-one', '/prerendered-two'],
			staticAssets: ['/static-one', '/static-two'],
			wasmFiles: [
				{
					identifier: 'wasm-one',
					importPath: '/wasm/wasm-one.wasm',
					originalFileLocation: expect.stringMatching(
						/\/assets\/wasm\/wasm-one\.wasm/
					),
				},
			],
		});

		mockedConsole.mockRestore();
		mockFs.restore();
	});
});
