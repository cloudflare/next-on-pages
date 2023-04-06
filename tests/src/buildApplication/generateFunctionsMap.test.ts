import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { generateFunctionsMap } from '../../../src/buildApplication/generateFunctionsMap';
import { normalizePath } from '../../../src/utils';

beforeAll(() => {
	vi.mock('node:fs/promises', async () => {
		return {
			readFile: async (rawFile: string) => {
				const file = normalizePath(rawFile);
				if (
					/invalidTest\/functions\/middlewarejs.*\/\.vc-config\.json/.test(file)
				) {
					return JSON.stringify({
						runtime: 'edge',
						entrypoint: 'middleware.js',
					});
				}
				if (/invalidTest\/functions\/index.*\/\.vc-config\.json/.test(file)) {
					return JSON.stringify({ runtime: 'nodejs', entrypoint: 'index.js' });
				}
				if (
					/validTest\/functions\/middleware.*\/\.vc-config\.json/.test(file)
				) {
					return JSON.stringify({
						name: 'middleware',
						runtime: 'edge',
						entrypoint: file.includes('middlewarejs')
							? 'middleware.js'
							: 'index.js',
					});
				}
				if (/validTest\/functions\/.*\/\.vc-config\.json/.test(file)) {
					return JSON.stringify({
						runtime:
							file.includes('should-be-valid') && !file.includes('is-valid')
								? 'nodejs'
								: 'edge',
						entrypoint: 'index.js',
					});
				}
				return '';
			},
			mkdir: async () => null,
			writeFile: async () => null,
			stat: async (path: string) => {
				// NOTE: Invalid file is used to (in a hacky way) simulate an function called `middlewarejs` that has an entry point of `middleware.js` being changed to `index.js`, and that new entry point not existing in the file system. Hence, it would be an invalid file, and `isDirectory()` and `isFile()` will then be false.
				const invalidFile =
					path.includes('invalidTest') &&
					path.includes('middlewarejs') &&
					path.endsWith('.js');
				const isFile = path.endsWith('.js') || path.endsWith('.json');

				return {
					isDirectory: () => !invalidFile && !isFile,
					isFile: () => !invalidFile && isFile,
				};
			},
			readdir: async (rawDir: string) => {
				const dir = normalizePath(rawDir);
				if (['validTest/functions', 'invalidTest/functions'].includes(dir)) {
					return [
						'api',
						'index.func',
						'index.rsc.func',
						'middlewarejs.func',
						'base/middleware.func',
						'path/(group-1)/to/(group-2)/page.func',
						'(is-valid)/should-be-valid.func', // valid
						'should-be-valid.func', // invalid
						'should-be-valid-alt.func', // invalid
						'rsc/(is-valid)/should-be-valid.func', // valid
						'rsc/should-be-valid.rsc.func', // invalid
					];
				}
				if (
					['validTest/functions/api', 'invalidTest/functions/api'].includes(dir)
				) {
					return ['hello.func'];
				}
				return [];
			},
		};
	});
});

afterAll(() => {
	vi.clearAllMocks();
});

describe('generateFunctionsMap', async () => {
	test('should generate a valid functions map (without experimentalMinify), accounting for invalid root-level functions', async () => {
		const { invalidFunctions, functionsMap } = await generateFunctionsMap(
			'validTest/functions',
			false
		);

		// NOTE: The invalid function here is used to test that invalid functions on the root-level are considered invalid, while a valid squashed function (in a route group) replaces an equivalent invalid function that exists on the root-level.
		// i.e. `(is-valid)/should-be-valid.func` replaces the invalid `should-be-valid.func` on the root-level, and `should-be-valid-alt.func` is still invalid.
		expect(invalidFunctions.size).toEqual(1);
		expect(Array.from(invalidFunctions.values())).toEqual([
			'should-be-valid-alt.func',
		]);

		expect(functionsMap.size).toEqual(10);
		// index
		expect(functionsMap.get('/')).toMatch(/\/index\.func\.js$/);
		expect(functionsMap.get('/index')).toMatch(/\/index\.func\.js$/);
		expect(functionsMap.get('/index.rsc')).toMatch(/\/index\.rsc\.func\.js$/);
		// nested route
		expect(functionsMap.get('/api/hello')).toMatch(/\/api\/hello\.func\.js$/);
		// middleware
		expect(functionsMap.get('/middlewarejs')).toMatch(
			/\/middlewarejs\.func\.js$/
		);
		expect(functionsMap.get('/base/middleware')).toMatch(
			/\/base\/middleware\.func\.js$/
		);
		// route group
		expect(functionsMap.get('/path/to/page')).toMatch(
			/\/path\/\(group-1\)\/to\/\(group-2\)\/page\.func\.js$/
		);
		expect(functionsMap.get('/should-be-valid')).toMatch(
			/\(is-valid\)\/should-be-valid\.func\.js$/
		);
		expect(functionsMap.get('/rsc/should-be-valid')).toMatch(
			/rsc\/\(is-valid\)\/should-be-valid\.func\.js$/
		);
		expect(functionsMap.get('/rsc/should-be-valid.rsc')).toMatch(
			/rsc\/\(is-valid\)\/should-be-valid\.func\.js$/
		);
	});

	// TODO: add tests that also test the functions map with the experimentalMinify flag

	test('should return invalid functions', async () => {
		const { invalidFunctions } = await generateFunctionsMap(
			'invalidTest/functions',
			false
		);

		expect(invalidFunctions.size).toEqual(3);
		expect(Array.from(invalidFunctions.values())).toEqual([
			'index.func',
			'index.rsc.func',
			'should-be-valid-alt.func',
		]);
	});
});
