import { describe, test, expect, vi } from 'vitest';
import { generateFunctionsMap } from '../../../src/buildApplication/generateFunctionsMap';
import mockFs from 'mock-fs';

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

describe('generateFunctionsMap', async () => {
	test('should generate a valid functions map (without experimentalMinify), accounting for invalid root-level functions', async () => {
		mockFs({
			functions: {
				'index.func': validFuncDir,
				'index.rsc.func': validFuncDir,
				api: {
					'hello.func': validFuncDir,
				},
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
				path: {
					'(group-1)': {
						to: {
							'(group-2)': {
								'page.func': validFuncDir,
							},
						},
					},
				},
				'(is-valid)': {
					'should-be-valid.func': validFuncDir,
				},
				rsc: {
					'(is-valid)': {
						'should-be-valid.func': validFuncDir,
						'should-be-valid.rsc.func': validFuncDir,
					},
				},
			},
		});

		const { functionsMap } = await generateFunctionsMap('functions', false);

		// Do we still need to test this? @james-elicx
		// // NOTE: The invalid function here is used to test that invalid functions on the root-level are considered invalid, while a valid squashed function (in a route group) replaces an equivalent invalid function that exists on the root-level.
		// // i.e. `(is-valid)/should-be-valid.func` replaces the invalid `should-be-valid.func` on the root-level, and `should-be-valid-alt.func` is still invalid.
		// expect(Array.from(invalidFunctions.values())).toEqual([
		// 	'should-be-valid-alt.func',
		// ]);

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
			/rsc\/\(is-valid\)\/should-be-valid\.rsc\.func\.js$/
		);

		mockFs.restore();
	});

	test('should return invalid functions', async () => {
		mockFs({
			functions: {
				'should-be-valid-alt.func': {
					'.vc-config.json': invalidIndexVcConfigJson,
				},
				'index.func': invalidFuncDir,
				'index.rsc.func': invalidFuncDir,
			},
		});

		const { invalidFunctions } = await generateFunctionsMap('functions', false);

		expect(Array.from(invalidFunctions.values())).toEqual([
			'index.func',
			'index.rsc.func',
			'should-be-valid-alt.func',
		]);

		mockFs.restore();
	});

	test('should ignore a generated middleware.js file while also proving a warning', async () => {
		const fn = vi.fn()
		// eslint-disable-next-line no-console
		console.warn = fn;

		mockFs({
			functions: {
				'middlewarejs.func': {
					'.vc-config.json': JSON.stringify({
						name: 'middleware',
						runtime: 'edge',
						entrypoint: 'middleware.js',
					}),
					'middleware.js': '',
				},
			},
		});

		const { invalidFunctions } = await generateFunctionsMap('functions', false);
		expect(Array.from(invalidFunctions.values())).toEqual([]);

		expect(fn.mock.calls.length).toBe(1);
		expect(fn.mock.calls[0]?.[0]).toMatch(/invalid middleware function for middlewarejs.func/);

		mockFs.restore();
	});

	// TODO: add tests that also test the functions map with the experimentalMinify flag
});
