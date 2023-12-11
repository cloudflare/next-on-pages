import { describe, test, expect, afterEach, vi } from 'vitest';
import mockFs from 'mock-fs';
import {
	collectFunctionsFrom,
	mockConsole,
	edgeFuncDir,
	nodejsFuncDir,
	getRouteInfo,
	createPrerenderedRoute,
} from '../../../_helpers';
import { resolve } from 'path';
import { processEdgeFunctions } from '../../../../src/buildApplication/processVercelFunctions/edgeFunctions';
import { checkInvalidFunctions } from '../../../../src/buildApplication/processVercelFunctions/invalidFunctions';
import { processPrerenderFunctions } from '../../../../src/buildApplication/processVercelFunctions/prerenderFunctions';

const functionsDir = resolve('.vercel/output/functions');

describe('checkInvalidFunctions', () => {
	afterEach(() => mockFs.restore());

	test('should ignore i18n index with valid alternative', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				'index.func': edgeFuncDir,
				'en.func': nodejsFuncDir,
			},
		});

		await processEdgeFunctions(collectedFunctions);
		await checkInvalidFunctions(collectedFunctions, {
			functionsDir,
			vercelConfig: {
				version: 3,
				routes: [{ src: '/(?<nextLocale>fr|en|nl)(/.*|$)' }],
				overrides: {
					"index.html": {
						"path": "index",
						"contentType": "text/html; charset=utf-8"
					}
				}
			},
		});
		restoreFsMock();

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(getRouteInfo(edgeFunctions, 'index.func')).toEqual({
			path: '/index',
			overrides: ['/', '/en'],
		});

		expect(invalidFunctions.size).toEqual(0);

		expect(ignoredFunctions.size).toEqual(1);
		expect(ignoredFunctions.has(resolve(functionsDir, 'en.func'))).toEqual(
			true,
		);
	});

	test('should ignore i18n nested route with valid alternative', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				test: { 'route.func': edgeFuncDir },
				en: { test: { 'route.func': nodejsFuncDir } },
			},
		});

		await processEdgeFunctions(collectedFunctions);
		await checkInvalidFunctions(collectedFunctions, {
			functionsDir,
			vercelConfig: {
				version: 3,
				routes: [{ src: '/(?<nextLocale>fr|en|nl)(/.*|$)' }],
				overrides: {
					"index.html": {
						"path": "index",
						"contentType": "text/html; charset=utf-8"
					}
				}
			},
		});
		restoreFsMock();

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(1);
		expect(getRouteInfo(edgeFunctions, 'test/route.func')).toEqual({
			path: '/test/route',
			overrides: ['/en/test/route'],
		});

		expect(invalidFunctions.size).toEqual(0);

		expect(ignoredFunctions.size).toEqual(1);
		expect(
			ignoredFunctions.has(resolve(functionsDir, 'en/test/route.func')),
		).toEqual(true);
	});

	test('should not ignore i18n with no valid alternative', async () => {
		const processExitMock = vi
			.spyOn(process, 'exit')
			.mockImplementation(async () => undefined as never);
		const mockedConsole = mockConsole('error');

		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				'en.func': nodejsFuncDir,
			},
		});

		await processEdgeFunctions(collectedFunctions);
		await checkInvalidFunctions(collectedFunctions, {
			functionsDir,
			vercelConfig: {
				version: 3,
				routes: [{ src: '/(?<nextLocale>fr|en|nl)(/.*|$)' }],
			},
		});
		restoreFsMock();

		const { edgeFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(edgeFunctions.size).toEqual(0);

		expect(invalidFunctions.size).toEqual(1);
		expect(invalidFunctions.has(resolve(functionsDir, 'en.func'))).toEqual(
			true,
		);

		expect(ignoredFunctions.size).toEqual(0);

		expect(processExitMock).toHaveBeenCalledWith(1);
		mockedConsole.expectCalls([
			/The following routes were not configured to run with the Edge Runtime(?:.|\n)+- \/en/,
		]);

		processExitMock.mockRestore();
		mockedConsole.restore();
	});

	test('should ignore base path index with valid alternative', async () => {
		const { collectedFunctions, restoreFsMock } = await collectFunctionsFrom({
			functions: {
				foo: createPrerenderedRoute('index', 'foo'),
				'foo.func': nodejsFuncDir,
			},
		});

		const opts = {
			functionsDir,
			outputDir: resolve('.vercel/output/static'),
			vercelConfig: { version: 3 as const },
		};

		await processEdgeFunctions(collectedFunctions);
		await processPrerenderFunctions(collectedFunctions, opts);
		await checkInvalidFunctions(collectedFunctions, opts);
		restoreFsMock();

		const { prerenderedFunctions, invalidFunctions, ignoredFunctions } =
			collectedFunctions;

		expect(prerenderedFunctions.size).toEqual(2);
		expect(getRouteInfo(prerenderedFunctions, 'foo/index.func')).toEqual({
			path: '/foo/index.html',
			overrides: ['/foo/index', '/foo'],
			headers: {
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
		});
		expect(getRouteInfo(prerenderedFunctions, 'foo/index.rsc.func')).toEqual({
			path: '/foo/index.rsc',
			overrides: ['/foo.rsc'],
			headers: {
				'content-type': 'text/x-component',
				vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
			},
		});

		expect(invalidFunctions.size).toEqual(0);

		expect(ignoredFunctions.size).toEqual(1);
		expect(ignoredFunctions.has(resolve(functionsDir, 'foo.func'))).toEqual(
			true,
		);
	});
});
