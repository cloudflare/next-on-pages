import { describe, test, expect, vi } from 'vitest';
import { getNodeEnv } from '../../../src/utils/getNodeEnv';

describe('getNodeEnv', () => {
    test('should default NODE_ENV to "production"', async () => {
        runWithNodeEnv('', () => {
            const nodeEnv = getNodeEnv();
            expect(nodeEnv).toBe('production');
        });
    });

    ['production', 'development', 'test'].forEach(testNodeEnv =>
        test(`should set the NODE_ENV to ${testNodeEnv} correctly`, async () => {
            runWithNodeEnv(testNodeEnv, () => {
                const nodeEnv = getNodeEnv();
                expect(nodeEnv).toBe(testNodeEnv);
            });
        })
    );

    test('should set the NODE_ENV to a non-Next.js value correctly but generate a warning', async () => {
        runWithNodeEnv('non-next-value', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => null);
            const nodeEnv = getNodeEnv();
            expect(nodeEnv).toBe('non-next-value');
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('WARNING:'));
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
