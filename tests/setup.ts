import { vi } from 'vitest';
import { normalizePath } from '../src/utils';

const baseConfig = { entrypoint: 'index.js' };
const edgeConfig = JSON.stringify({ ...baseConfig, runtime: 'edge' });
const nodeConfig = JSON.stringify({ ...baseConfig, runtime: 'nodejs' });

const entryFile = '// js file';

const edgeFunction = { '.vc-config.json': edgeConfig, 'index.js': entryFile };
const nodeFunction = { '.vc-config.json': nodeConfig, 'index.js': entryFile };

// Fake file tree used for the mock of `fs/promises` in unit tests.
const paths = {
	'.next': {
		'routes-manifest.json': JSON.stringify({ version: 3, basePath: '/test' }),
	},
	validTest: {
		functions: {
			api: { 'hello.func': edgeFunction },
			'index.func': edgeFunction,
			'index.rsc.func': edgeFunction,
		},
	},
	invalidTest: {
		functions: {
			api: { 'hello.func': nodeFunction },
			'index.func': nodeFunction,
			'index.rsc.func': nodeFunction,
		},
	},
} as const;

/**
 * Finds a path in the fake file tree.
 *
 * @param path Path to find in the fake file tree.
 * @returns Children of the path, or the file contents, or null if the path is not found.
 */
const findPath = (path: string): Record<string, unknown> | string | null => {
	const parts = normalizePath(path).split('/');

	let current = paths;
	for (const part of parts) {
		if (current[part]) {
			current = current[part];
		} else {
			return null;
		}
	}

	return current;
};

vi.mock('node:fs/promises', async () => ({
	readFile: async (file: string) =>
		new Promise((res, rej) => {
			const resolved = findPath(file);

			if (typeof resolved === 'string') {
				return res(resolved);
			}
			return rej('Path not found');
		}),
	mkdir: async () => null,
	writeFile: async () => null,
	stat: async (path: string) =>
		new Promise((res, rej) => {
			const resolved = findPath(path);

			if (resolved !== null) {
				return res({
					isDirectory: () => typeof resolved === 'object',
					isFile: () => typeof resolved === 'string',
				});
			}
			return rej('Path not found');
		}),
	readdir: async (dir: string) =>
		new Promise((res, rej) => {
			const resolved = findPath(dir);

			if (!!resolved && typeof resolved === 'object') {
				return res(Object.keys(resolved));
			}
			return rej(!resolved ? 'Path not found' : 'Not a directory');
		}),
}));
