import { describe, test, expect, vi, afterEach } from 'vitest';
import { generateFunctionsMap } from '../../../src/buildApplication/generateFunctionsMap';
import mockFs from 'mock-fs';
import type { DirectoryItems } from 'mock-fs/lib/filesystem';
import { resolve } from 'path';
import { mockConsole } from '../../_helpers';
import { writeFile } from 'fs/promises';
import {
	getVercelStaticAssets,
	processOutputDir,
} from '../../../src/buildApplication/processVercelOutput';

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

/**
 * Generates a functions map from the given functions and static assets.
 *
 * @param functions Functions directory items
 * @param staticAssets Static assets directory items
 * @param disableChunksDedup Whether to disable chunks deduplication
 * @param outputDir Output directory to use for worker and static assets
 * @param otherDirs Other root-level directories to create in the mock file system
 * @returns Results from generating the functions map
 */
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

	await processOutputDir(outputDir, await getVercelStaticAssets());
	const result = await generateFunctionsMap(
		resolve('.vercel', 'output', 'functions'),
		outputDir,
		disableChunksDedup
	);
	return result;
}
