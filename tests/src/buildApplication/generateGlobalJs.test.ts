import { describe, test, expect, vi } from 'vitest';
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

	describe('NODE_ENV', () => {
		test('should default NODE_ENV to "production"', async () => {
			runWithNodeEnv('', () => {
				const globalJs = generateGlobalJs();
				const expected = "__ENV_ALS__['NODE_ENV'] = 'production'";
				expect(globalJs).toContain(expected);
			});
		});

		['production', 'development', 'test'].forEach(testNodeEnv =>
			test(`should set the NODE_ENV to ${testNodeEnv} correctly`, async () => {
				runWithNodeEnv(testNodeEnv, () => {
					const globalJs = generateGlobalJs();
					const expected = `__ENV_ALS__['NODE_ENV'] = '${testNodeEnv}'`;
					expect(globalJs).toContain(expected);
				});
			})
		);

		test('should set the NODE_ENV to a non-Next.js value correctly but generate a warning', async () => {
			runWithNodeEnv('non-next-value', () => {
				const spy = vi.spyOn(console, 'warn').mockImplementation(() => null);
				const globalJs = generateGlobalJs();
				const expected = "__ENV_ALS__['NODE_ENV'] = 'non-next-value'";
				expect(globalJs).toContain(expected);
				expect(spy).toHaveBeenCalledWith(expect.stringContaining('WARNING:'));
			});
		});
	});
});

function runWithNodeEnv<F extends (...args: unknown[]) => void>(
	value: string,
	testFn: F
): void {
	const oldNodeEnv = process.env.NODE_ENV;
	process.env.NODE_ENV = value;
	testFn();
	process.env.NODE_ENV = oldNodeEnv;
}
