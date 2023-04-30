import { describe, expect, suite, test, vi } from 'vitest';
import { router } from '../../templates/_worker.js/router';
import {
	basicEdgeAppDirTestSet,
	basicStaticAppDirTestSet,
	configRewritesRedirectsHeadersTestSet,
	dynamicRoutesTestSet,
	middlewareTestSet,
} from './routerTestData';
import type { TestCase, TestSet } from '../_helpers';
import { createRouterTestData } from '../_helpers';

/**
 * Runs a test case.
 *
 * @param requestRouter Router instance to use.
 * @param testCase Test case to run.
 */
function runTestCase(
	requestRouter: ReturnType<typeof router>,
	testCase: TestCase
) {
	test(testCase.name, async () => {
		const { paths, headers, expected } = testCase;

		const urls = paths.map(p => `http://localhost${p}`);
		for (const url of urls) {
			const mockedConsoleError = vi
				.spyOn(console, 'error')
				.mockImplementation(() => null);

			const req = new Request(url, { headers });
			const match = await requestRouter.match(req);
			const res = await requestRouter.serve(req, match);

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
 * @param args.config Processed Vercel build output config.
 * @param args.files Vercel build output files.
 * @param args.testCases Test cases to run.
 */
async function runTestSet({ config, files, testCases }: TestSet) {
	const { vercelConfig, buildOutput, assetsFetcher } =
		await createRouterTestData(config, files);

	const requestRouter = router(
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
		configRewritesRedirectsHeadersTestSet,
		dynamicRoutesTestSet,
		middlewareTestSet,
	].forEach(testSet => {
		describe(testSet.name, () => runTestSet(testSet));
	});
});
