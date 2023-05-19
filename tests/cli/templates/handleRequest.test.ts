import { afterAll, expect, suite, test, vi } from 'vitest';
import {
	basicEdgeAppDirTestSet,
	basicStaticAppDirTestSet,
	checkRouteMatchTestSet,
	configRewritesRedirectsHeadersTestSet,
	dynamicRoutesTestSet,
	i18nTestSet,
	infiniteLoopTestSet,
	middlewareTestSet,
	trailingSlashTestSet,
} from './requestTestData';
import type { TestCase, TestSet } from '../_helpers';
import { createRouterTestData } from '../_helpers';
import type { RequestContext } from '../../../src/cli/utils/requestContext';
import { handleRequest } from '../../../src/cli/templates/_worker.js/handleRequest';
import { writeFile } from 'fs/promises';

import { describe } from 'vitest';

vi.mock('acorn', async () => {
	return {
		parse: () => {
			return {
				body: [],
			};
		},
	};
});

/**
 * Runs a test case.
 *
 * @param reqCtx partial request context to use for the tests.
 * @param testCase Test case to run.
 */
function runTestCase(
	reqCtx: Pick<RequestContext, 'assetsFetcher' | 'ctx'>,
	config: ProcessedVercelConfig,
	output: VercelBuildOutput,
	testCase: TestCase
) {
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
			const res = await handleRequest(
				{ ...reqCtx, request: req },
				config,
				output
			);

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
	const { vercelConfig, buildOutput, assetsFetcher, restoreMocks } =
		await createRouterTestData(config, files);

	const reqCtx: Pick<RequestContext, 'assetsFetcher' | 'ctx'> = {
		assetsFetcher,
		ctx: {} as ExecutionContext,
	};

	testCases.forEach(testCase =>
		runTestCase(reqCtx, vercelConfig, buildOutput, testCase)
	);

	afterAll(() => restoreMocks());
}

vi.mock('esbuild', async () => {
	return {
		build: (options: { stdin?: { contents: string }; outfile: string }) => {
			const contents = options.stdin?.contents ?? 'built code';
			writeFile(options.outfile, contents);
		},
	};
});

suite('router', () => {
	[
		basicEdgeAppDirTestSet,
		basicStaticAppDirTestSet,
		checkRouteMatchTestSet,
		configRewritesRedirectsHeadersTestSet,
		dynamicRoutesTestSet,
		i18nTestSet,
		infiniteLoopTestSet,
		middlewareTestSet,
		trailingSlashTestSet,
	].forEach(testSet => {
		describe(testSet.name, () => runTestSet(testSet));
	});
});
