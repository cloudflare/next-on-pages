import { afterAll, expect, suite, test, vi } from 'vitest';
import {
	basicEdgeAppDirTestSet,
	basicStaticAppDirTestSet,
	checkRouteMatchTestSet,
	configRewritesRedirectsHeadersTestSet,
	dynamicRoutesTestSet,
	i18nTestSet,
	infiniteLoopTestSet,
	trailingSlashTestSet,
} from './requestTestData';
import type { TestCase, TestSet } from '../_helpers';
import { mockConsole } from '../_helpers';
import { createRouterTestData } from '../_helpers';
import type { RequestContext } from '../../src/utils/requestContext';
import { handleRequest } from '../../templates/_worker.js/handleRequest';
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
	testCase: TestCase,
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
			const mockedConsoleError = mockConsole('error');
			const mockedConsoleLog = mockConsole('log');

			const req = new Request(url, { method, headers });
			const res = await handleRequest(
				{ ...reqCtx, request: req },
				config,
				output,
			);

			expect(res.status).toEqual(expected.status);
			const textContent = await res.text();
			if (expected.data instanceof RegExp) {
				expect(textContent).toMatch(expected.data);
			} else {
				expect(textContent).toEqual(expected.data);
			}
			if (!expected.ignoreHeaders) {
				expect(Object.fromEntries(res.headers.entries())).toEqual(
					expected.headers || {},
				);
			}
			if (expected.reqHeaders) {
				expect(Object.fromEntries(req.headers.entries())).toEqual(
					expected.reqHeaders,
				);
			}

			mockedConsoleError.expectCalls(expected.mockConsole?.error ?? []);
			mockedConsoleError.restore();
			mockedConsoleLog.expectCalls(expected.mockConsole?.log ?? []);
			mockedConsoleLog.restore();
		}
	});
}

/**
 * Runs a test set.
 *
 * @param testSet Test set to run.
 */
async function runTestSet({ config, files, testCases }: TestSet) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (...args: Parameters<typeof originalFetch>) => {
		const req = new Request(...args);
		const url = new URL(req.url);

		if (url.hostname === 'external-test-url.com') {
			return new Response('external test url response');
		}

		return originalFetch(...args);
	};

	const { vercelConfig, buildOutput, assetsFetcher, restoreMocks } =
		await createRouterTestData(config, files);

	const reqCtx: Pick<RequestContext, 'assetsFetcher' | 'ctx'> = {
		assetsFetcher,
		ctx: {} as ExecutionContext,
	};

	testCases.forEach(testCase =>
		runTestCase(reqCtx, vercelConfig, buildOutput, testCase),
	);

	afterAll(() => {
		globalThis.fetch = originalFetch;
		restoreMocks();
	});
}

vi.mock('esbuild', async () => {
	return {
		build: async (options: {
			stdin?: { contents: string };
			outfile: string;
		}) => {
			const contents = options.stdin?.contents ?? 'built code';
			await writeFile(options.outfile, contents);
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
		trailingSlashTestSet,
	].forEach(testSet => {
		describe(testSet.name, async () => runTestSet(testSet));
	});
});
