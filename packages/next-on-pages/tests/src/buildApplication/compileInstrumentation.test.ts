import { describe, expect, test, vi } from 'vitest';
import { build } from 'esbuild';
import { compileInstrumentation } from '../../../src/buildApplication/compileInstrumentation';
import * as utils from '../../../src/utils';

vi.mock('../../../src/utils');
vi.mock('../../../src/cli');
vi.mock('esbuild');

describe('compileInstrumentation', () => {
	const mockValidateFile = vi.mocked(utils.validateFile);
	const mockBuild = vi.mocked(build);

	test('should pass correct esbuild configuration', async () => {
		mockValidateFile.mockImplementation(async path => {
			return path === '/project/instrumentation.ts';
		});
		mockBuild.mockResolvedValue({ errors: [], warnings: [] });

		await compileInstrumentation('/project', '/dist');

		expect(mockBuild).toHaveBeenCalledWith({
			entryPoints: ['/project/instrumentation.ts'],
			outfile: '/dist/instrumentation.js',
			bundle: true,
			format: 'esm',
			target: 'es2022',
			platform: 'node',
			minify: true,
			plugins: expect.arrayContaining([
				expect.objectContaining({ name: 'server-only-stub' }),
			]),
			external: ['node:*', 'cloudflare:*'],
			define: {
				'process.env.NEXT_RUNTIME': '"edge"',
			},
			conditions: ['react-server'],
		});
	});

	test('should return null when esbuild fails', async () => {
		mockValidateFile.mockImplementation(async path => {
			return path === '/project/instrumentation.ts';
		});
		mockBuild.mockRejectedValue(new Error('Build failed'));

		const result = await compileInstrumentation('/project', '/dist');

		expect(result).toBe(null);
	});

	test('should check all standard locations in order', async () => {
		const checkedPaths: string[] = [];
		mockValidateFile.mockImplementation(async path => {
			checkedPaths.push(path);
			return false;
		});

		await compileInstrumentation('/project', '/dist');

		expect(checkedPaths).toEqual([
			'/project/instrumentation.ts',
			'/project/instrumentation.js',
			'/project/src/instrumentation.ts',
			'/project/src/instrumentation.js',
			'/project/app/instrumentation.ts',
			'/project/app/instrumentation.js',
		]);
	});
});
