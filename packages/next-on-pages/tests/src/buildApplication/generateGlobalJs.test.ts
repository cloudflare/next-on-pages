import { describe, test, expect } from 'vitest';
import { generateGlobalJs } from '../../../src/buildApplication/generateGlobalJs';

describe('generateGlobalJs', async () => {
	describe('AsyncLocalStorage', () => {
		test('should generate a promise for the AsyncLocalStorage import', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				"const __ENV_ALS_PROMISE__ = import('node:async_hooks')",
			);
		});

		test('should make the AsyncLocalStorage globally available', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				'globalThis.AsyncLocalStorage = AsyncLocalStorage',
			);
		});

		test('create an AsyncLocalStorage and set it as a proxy to process.env', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				'const envAsyncLocalStorage = new AsyncLocalStorage()',
			);

			const proxyRegexMatch = globalJs.match(
				/globalThis.process = {[\S\s]*Proxy\(([\s\S]+)\)[\s\S]+}/,
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
	});
});
