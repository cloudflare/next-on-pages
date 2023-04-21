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

	describe('without experimentalMinify should correctly handle', () => {
		test('valid index routes', async () => {
			mockFs({
				functions: {
					'index.func': validFuncDir,
					'index.rsc.func': validFuncDir,
				},
			});
	
			const { functionsMap } = await generateFunctionsMap('functions', false);
	
			expect(functionsMap.size).toEqual(3);
			expect(functionsMap.get('/')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index')).toMatch(/\/index\.func\.js$/);
			expect(functionsMap.get('/index.rsc')).toMatch(/\/index\.rsc\.func\.js$/);

			mockFs.restore();
		})

		test('valid nested routes', async () => {
			mockFs({
				functions: {
					api: {
						'hello.func': validFuncDir,
					},
				},
			});
	
			const { functionsMap } = await generateFunctionsMap('functions', false);
	
			expect(functionsMap.size).toEqual(1);
			expect(functionsMap.get('/api/hello')).toMatch(/\/api\/hello\.func\.js$/);

			mockFs.restore();
		})


		test('valid middlewares (and ignore their potential middleware.js file)', async () => {
			mockFs({
				functions: {
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
				},
			});
	
			const { functionsMap } = await generateFunctionsMap('functions', false);
	
			expect(functionsMap.size).toEqual(2);
			expect(functionsMap.get('/middlewarejs')).toMatch(
				/\/middlewarejs\.func\.js$/
			);
			expect(functionsMap.get('/base/middleware')).toMatch(
				/\/base\/middleware\.func\.js$/
			);
			mockFs.restore();
		})
	})

	test('should squash valid routes in route groups', async () => {
		mockFs({
			functions: {
				path: {
					'(group-1)': {
						to: {
							'(group-2)': {
								'page.func': validFuncDir,
							},
						},
					},
				},
			},
		});

		const { functionsMap } = await generateFunctionsMap('functions', false);

		expect(functionsMap.size).toEqual(1);
		expect(functionsMap.get('/path/to/page')).toMatch(
			/\/path\/\(group-1\)\/to\/\(group-2\)\/page\.func\.js$/
		);

		mockFs.restore();
	});

	test('should squash invalid root functions', async () => {
		mockFs({
			functions: {
				'should-be-valid.func': invalidFuncDir,
				'(is-actually-valid)': {
					'should-be-valid.func': validFuncDir,
				}
			},
		});

		const { invalidFunctions, functionsMap } = await generateFunctionsMap('functions', false);

		expect(Array.from(invalidFunctions.values())).toEqual([
		]);
		expect(functionsMap.size).toEqual(1);
		expect(functionsMap.get('/should-be-valid')).toMatch(
			/\(is-actually-valid\)\/should-be-valid\.func\.js$/
		);

		mockFs.restore();
	});

	test('should return invalid functions', async () => {
		mockFs({
			functions: {
				'index.func': invalidFuncDir,
				'index.rsc.func': invalidFuncDir,
			},
		});

		const { invalidFunctions } = await generateFunctionsMap('functions', false);

		expect(Array.from(invalidFunctions.values())).toEqual([
			'index.func',
			'index.rsc.func',
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
