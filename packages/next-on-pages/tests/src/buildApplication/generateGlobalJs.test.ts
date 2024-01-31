import { describe, test, expect } from 'vitest';
import { generateGlobalJs } from '../../../src/buildApplication/generateGlobalJs';

describe('generateGlobalJs', async () => {
	describe('AsyncLocalStorage', () => {
		test('should generate a promise for the AsyncLocalStorage import', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				"const __ALSes_PROMISE__ = import('node:async_hooks')",
			);
		});

		test('should make the AsyncLocalStorage globally available', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				'globalThis.AsyncLocalStorage = AsyncLocalStorage',
			);
		});

		test('should make the Buffer globally available', async () => {
			/*
				Note: we need Buffer in the global scope
					as it is sometimes used by Next under the hood
			*/
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain('globalThis.Buffer = Buffer');
		});

		test('create an AsyncLocalStorage and set it as a proxy to process.env', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				'const envAsyncLocalStorage = new AsyncLocalStorage()',
			);

			const proxyRegexMatch = globalJs.match(
				/globalThis.process = {[\S\s]*?new Proxy\(([\s\S]+)\)[\s\S]+}/,
			);

			expect(proxyRegexMatch?.length).toBe(2);

			const proxyBody = proxyRegexMatch?.[1];
			expect(proxyBody).toContain(
				'Reflect.get(envAsyncLocalStorage.getStore()',
			);
			expect(proxyBody).toContain(
				'Reflect.set(envAsyncLocalStorage.getStore()',
			);
		});

		test('create an AsyncLocalStorage and set it as a proxy to the global cloudflare request context variable', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				'const requestContextAsyncLocalStorage = new AsyncLocalStorage()',
			);

			const proxyRegexMatch = globalJs.match(
				/globalThis\[Symbol\.for\('__cloudflare-request-context__'\)\] = [\S\s]*?new Proxy\(([\s\S]+)\)[\s\S]+/,
			);

			expect(proxyRegexMatch?.length).toBe(2);

			const proxyBody = proxyRegexMatch?.[1];
			expect(proxyBody).toContain(
				'Reflect.get(requestContextAsyncLocalStorage.getStore()',
			);
			expect(proxyBody).toContain(
				'Reflect.set(requestContextAsyncLocalStorage.getStore()',
			);
		});
	});
});
