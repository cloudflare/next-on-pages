import { describe, expect, suite, test, vi } from 'vitest';
import {
	basicEdgeAppDirTestSet,
	basicStaticAppDirTestSet,
	checkRouteMatchTestSet,
	configRewritesRedirectsHeadersTestSet,
	dynamicRoutesTestSet,
	middlewareTestSet,
} from './routerTestData';
import type { TestCase, TestSet } from '../_helpers';
import { createRouterTestData } from '../_helpers';
import { Router } from '../../templates/_worker.js/router';

/**
 * Runs a test case.
 *
 * @param requestRouter Router instance to use.
 * @param testCase Test case to run.
 */
function runTestCase(requestRouter: Router, testCase: TestCase) {
	test(testCase.name, async () => {
		const {
			paths,
			headers,
			host = 'localhost',
			method = 'GET',
			expected,
		} = testCase;

		const urls = paths.map(p => `http://${host}${p}`);
		for (const url of urls) {
			const mockedConsoleError = vi
				.spyOn(console, 'error')
				.mockImplementation(() => null);

			const req = new Request(url, { method, headers });
			const res = await requestRouter.handle(req);

			expect(res.status).toEqual(expected.status);
			await expect(res.text()).resolves.toEqual(expected.data);
			expect(Object.fromEntries(res.headers.entries())).toEqual(
				expected.headers || {}
			);
			if (expected.reqHeaders) {
				expect(Object.fromEntries(req.headers.entries())).toEqual(
					expected.reqHeaders
				);
			}

			const consoleErrorExp = expected.mockConsole?.error ?? [];
			expect(mockedConsoleError).toHaveBeenCalledTimes(consoleErrorExp.length);
			consoleErrorExp.forEach((val, i) => {
				expect(mockedConsoleError.mock.calls[i]?.[0]).toEqual(val);
			});

			mockedConsoleError.mockRestore();
		}
	});
}

/**
 * Runs a test set.
 *
 * @param testSet Test set to run.
 */
async function runTestSet({ config, files, testCases }: TestSet) {
	const { vercelConfig, buildOutput, assetsFetcher } =
		await createRouterTestData(config, files);

	const requestRouter = new Router(
		vercelConfig,
		buildOutput,
		assetsFetcher,
		{} as ExecutionContext
	);

	testCases.forEach(testCase => runTestCase(requestRouter, testCase));
}

suite('router', () => {
	[
		basicEdgeAppDirTestSet,
		basicStaticAppDirTestSet,
		checkRouteMatchTestSet,
		configRewritesRedirectsHeadersTestSet,
		dynamicRoutesTestSet,
		middlewareTestSet,
	].forEach(testSet => {
		describe(testSet.name, () => runTestSet(testSet));
	});
});
