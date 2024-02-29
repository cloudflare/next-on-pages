/* eslint-disable no-global-assign -- needed since here we tweak the global process object */
import { describe, expect, test, vi, afterEach } from 'vitest';
import { getOptionalRequestContext, getRequestContext } from '../../../src/api';

const cloudflareRequestContextSymbol = Symbol.for(
	'__cloudflare-request-context__',
);

vi.mock('server-only', () => ({}));

describe('get(Optional)RequestContext', () => {
	const originalProcess = process;

	afterEach(() => {
		// the unit tests here tweak the global process object
		// so let's restore it after each test runs
		process = originalProcess;

		// let's also make sure to remove the global cloudflare request
		// context that some tests set up
		delete (global as Record<symbol, unknown>)[cloudflareRequestContextSymbol];
	});

	describe('getOptionalRequestContext', () => {
		test('should error when running in the node.js runtime', () => {
			simulateNodeRuntime();
			expect(() => getOptionalRequestContext())
				.toThrowErrorMatchingInlineSnapshot(`
              "\`getRequestContext\` and \`getOptionalRequestContext\` can only be run
              inside the edge runtime, so please make sure to have included
              \`export const runtime = 'edge'\` in all the routes using such functions
              (regardless of whether they are used directly or indirectly through imports)."
            `);
		});

		test('should not error when running in the node.js runtime', () => {
			simulateEdgeRuntime();
			expect(() => getOptionalRequestContext()).not.toThrow();
		});

		test('should not error and return `undefined` when the request context is not found', () => {
			simulateEdgeRuntime();
			const requestContext = getOptionalRequestContext();
			expect(requestContext).toEqual(undefined);
		});

		test('should return the request context when it is found', () => {
			simulateEdgeRuntime();
			const mockRequestContext = { env: {}, cf: {}, ctx: {} };
			(global as Record<symbol, unknown>)[cloudflareRequestContextSymbol] =
				mockRequestContext;
			const requestContext = getOptionalRequestContext();
			expect(requestContext).toEqual(mockRequestContext);
		});
	});

	describe('getRequestContext', () => {
		test('should error when running in the node.js runtime', () => {
			simulateNodeRuntime();
			expect(() => getRequestContext()).toThrowErrorMatchingInlineSnapshot(`
              "\`getRequestContext\` and \`getOptionalRequestContext\` can only be run
              inside the edge runtime, so please make sure to have included
              \`export const runtime = 'edge'\` in all the routes using such functions
              (regardless of whether they are used directly or indirectly through imports)."
            `);
		});

		test('should throw when the request context is not found', () => {
			simulateEdgeRuntime();
			expect(() => getRequestContext()).toThrowErrorMatchingInlineSnapshot(
				'"Failed to retrieve the Cloudflare request context."',
			);
		});

		test('should return the request context when it is found', () => {
			simulateEdgeRuntime();
			const mockRequestContext = { env: {}, cf: {}, ctx: {} };
			(global as Record<symbol, unknown>)[cloudflareRequestContextSymbol] =
				mockRequestContext;
			const requestContext = getOptionalRequestContext();
			expect(requestContext).toEqual(mockRequestContext);
		});
	});
});

function simulateNodeRuntime() {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	process = { env: { NODE_ENV: '' }, release: { name: 'node' } };
}

function simulateEdgeRuntime() {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	process = { env: { NODE_ENV: '' }, release: { name: undefined } };
}
