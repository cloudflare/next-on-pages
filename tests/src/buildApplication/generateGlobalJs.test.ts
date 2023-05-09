import { describe, test, expect } from 'vitest';
import { generateGlobalJs } from '../../../src/buildApplication/generateGlobalJs';

describe('generateGlobalJs', async () => {
	describe('AsyncLocalStorage', () => {
		test('should make the AsyncLocalStorage globally available', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain(
				'globalThis.AsyncLocalStorage = AsyncLocalStorage'
			);
		});

		test('create an AsyncLocalStorage and set it as a proxy to process.env', async () => {
			const globalJs = generateGlobalJs();
			expect(globalJs).toContain('const __ENV_ALS__ = new AsyncLocalStorage()');

			const proxyRegexMatch = globalJs.match(
				/globalThis.process = {(?:.*)Proxy\((.*)\)(?:.*)}/
			);

			expect(proxyRegexMatch?.length).toBe(2);

			const proxyBody = proxyRegexMatch?.[1];
			expect(proxyBody).toContain('Reflect.get(__ENV_ALS__.getStore()');
			expect(proxyBody).toContain('Reflect.set(__ENV_ALS__.getStore()');
		});
	});
});
