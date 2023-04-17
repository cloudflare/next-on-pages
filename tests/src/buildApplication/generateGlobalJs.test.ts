import { describe, test, expect, vi } from 'vitest';
import { generateGlobalJs } from '../../../src/buildApplication/generateGlobalJs';

describe('generateGlobalContext', async () => {
	test('should default NODE_ENV to "production"', async () => {
		runWithNodeEnv('', () => {
			const globalJs = generateGlobalJs();
			const expected =
				"globalThis.process = { env: { NODE_ENV: 'production' } };";
			expect(globalJs).toBe(expected);
		});
	});

	['production', 'development', 'test'].forEach(testNodeEnv =>
		test(`should set the NODE_ENV to ${testNodeEnv} correctly`, async () => {
			runWithNodeEnv(testNodeEnv, () => {
				const globalJs = generateGlobalJs();
				const expected = `globalThis.process = { env: { NODE_ENV: '${testNodeEnv}' } };`;
				expect(globalJs).toBe(expected);
			});
		})
	);

	test('should set the NODE_ENV to a non-Next.js value correctly but generate a warning', async () => {
		runWithNodeEnv('non-next-value', () => {
			const spy = vi.spyOn(console, 'warn').mockImplementation(() => null);
			const globalJs = generateGlobalJs();
			const expected =
				"globalThis.process = { env: { NODE_ENV: 'non-next-value' } };";
			expect(globalJs).toBe(expected);
			expect(spy).toHaveBeenCalledWith(expect.stringContaining('WARNING:'));
		});
	});
});

function runWithNodeEnv<F extends (...args: unknown[]) => void>(
	value: string,
	testFn: F
): void {
	const oldNodeEnv = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = value;
	testFn();
	process.env['NODE_ENV'] = oldNodeEnv;
}
