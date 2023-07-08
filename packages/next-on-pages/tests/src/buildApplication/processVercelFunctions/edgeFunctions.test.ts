import { describe, test, expect, afterEach } from 'vitest';
import mockFs from 'mock-fs';
import {
	collectFunctionsFrom,
	mockConsole,
	edgeFuncDir,
	nodejsFuncDir,
	getRouteInfo,
	getRouteEntrypoint,
} from '../../../_helpers';
import { join, resolve } from 'path';
import { processEdgeFunctions } from '../../../../src/buildApplication/processVercelFunctions/edgeFunctions';

const functionsDir = resolve('.vercel/output/functions');

describe('processEdgeFunctions', () => {
	afterEach(() => mockFs.restore());

	test('valid index routes', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				'index.func': edgeFuncDir,
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions } = collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(getRouteInfo(edgeFunctions, 'index.func')).toEqual({
			path: '/index',
			overrides: ['/'],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('adds rsc routes as overrides if there is a valid non-rsc route', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				'index.func': edgeFuncDir,
				'index.rsc.func': edgeFuncDir,
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(getRouteInfo(edgeFunctions, 'index.func')).toEqual({
			path: '/index',
			overrides: ['/', '/index.rsc'],
		});

		expect(invalidFunctions.size).toEqual(0);

		expect(ignoredFunctions.size).toEqual(1);
		expect(ignoredFunctions.has(join(functionsDir, 'index.rsc.func'))).toEqual(
			true
		);
	});

	test('uses rsc route if there is no valid non-rsc route', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				'index.rsc.func': edgeFuncDir,
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(getRouteInfo(edgeFunctions, 'index.rsc.func')).toEqual({
			path: '/index.rsc',
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);
		expect(ignoredFunctions.size).toEqual(0);
	});

	test('valid nested routes', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				api: {
					'hello.func': edgeFuncDir,
				},
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions } = collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(getRouteInfo(edgeFunctions, 'api/hello.func')).toEqual({
			path: '/api/hello',
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('valid middlewares (and ignore their potential middleware.js file)', async () => {
		const collectedFunctions = await collectFunctionsFrom({
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
					'middleware.func': edgeFuncDir,
				},
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions } = collectedFunctions;

		expect(edgeFunctions.size).toEqual(2);

		expect(getRouteInfo(edgeFunctions, 'middlewarejs.func')).toEqual({
			path: '/middlewarejs',
			overrides: [],
		});
		expect(getRouteEntrypoint(edgeFunctions, 'middlewarejs.func')).toEqual(
			'index.js'
		);

		expect(getRouteInfo(edgeFunctions, 'base/middleware.func')).toEqual({
			path: '/base/middleware',
			overrides: [],
		});
		expect(getRouteEntrypoint(edgeFunctions, 'base/middleware.func')).toEqual(
			'index.js'
		);

		expect(invalidFunctions.size).toEqual(0);
	});

	test('should squash valid routes in route groups', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				path: {
					'(group-1)': {
						to: {
							'(group-2)': {
								'page.func': edgeFuncDir,
							},
						},
					},
				},
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions } = collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(
			getRouteInfo(edgeFunctions, 'path/(group-1)/to/(group-2)/page.func')
		).toEqual({
			path: '/path/to/page',
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('should squash invalid root functions with valid alternative', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				'should-be-valid.func': nodejsFuncDir,
				'(is-actually-valid)': {
					'should-be-valid.func': edgeFuncDir,
				},
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions } = collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(
			getRouteInfo(edgeFunctions, '(is-actually-valid)/should-be-valid.func')
		).toEqual({
			path: '/should-be-valid',
			overrides: [],
		});

		expect(invalidFunctions.size).toEqual(0);
	});

	test('should squash invalid root rsc functions with valid non-rsc alternative', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				'should-be-valid.rsc.func': nodejsFuncDir,
				'(is-actually-valid)': {
					'should-be-valid.func': edgeFuncDir,
				},
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(
			getRouteInfo(edgeFunctions, '(is-actually-valid)/should-be-valid.func')
		).toEqual({
			path: '/should-be-valid',
			overrides: ['/should-be-valid.rsc'],
		});

		expect(invalidFunctions.size).toEqual(0);

		expect(ignoredFunctions.size).toEqual(1);
		expect(
			ignoredFunctions.has(join(functionsDir, 'should-be-valid.rsc.func'))
		).toEqual(true);
	});

	test('should return invalid functions', async () => {
		const collectedFunctions = await collectFunctionsFrom({
			functions: {
				'index.func': nodejsFuncDir,
				'index.rsc.func': nodejsFuncDir,
			},
		});

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);

		expect(invalidFunctions.size).toEqual(2);
		expect(invalidFunctions.has(join(functionsDir, 'index.func'))).toEqual(
			true
		);
		expect(invalidFunctions.has(join(functionsDir, 'index.rsc.func'))).toEqual(
			true
		);

		expect(ignoredFunctions.size).toEqual(0);
	});

	test('should ignore a generated middleware.js file while also providing a warning', async () => {
		const mockedConsole = mockConsole('warn');

		const collectedFunctions = await collectFunctionsFrom({
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

		await processEdgeFunctions(collectedFunctions);

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);
		expect(invalidFunctions.size).toEqual(0);
		expect(ignoredFunctions.size).toEqual(1);

		mockedConsole.expectCalls([
			/invalid middleware function for \/middlewarejs\.func/,
		]);
		mockedConsole.restore();
	});
});
