import type { Plugin } from 'esbuild';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Builds a file using esbuild.
 *
 * Marks all Node.js, Wasm, and next-on-pages dist imports as external.
 *
 * @param contents File contents to build.
 * @param filePath File path to build to.
 * @param opts Relative path options.
 */
export async function buildFile(
	contents: string,
	filePath: string,
	{ relativeTo }: Omit<RelativePathOpts, 'from'> = {}
) {
	const relativeNopDistPath = join(
		getRelativePath({ from: filePath, relativeTo }),
		'__next-on-pages-dist__'
	);

	await mkdir(dirname(filePath), { recursive: true });
	await build({
		stdin: { contents },
		target: 'es2022',
		platform: 'neutral',
		outfile: filePath,
		bundle: true,
		external: ['node:*', `${relativeNopDistPath}/*`, '*.wasm'],
		minify: true,
		plugins: [nodeBuiltInModulesPlugin],
	});
}

/**
 * Gets the relative path of a function relative to a given path.
 *
 * @param opts The paths for working out the relative path.
 * @returns The relative path of the function.
 */
export function getRelativePath(opts: RelativePathOpts): string {
	return '../'.repeat(getFunctionNestingLevel(opts));
}

const functionsDir = resolve('.vercel', 'output', 'functions');

/**
 * Gets the nesting level of a function relative to a given path, or the functions directory by default.
 *
 * @param opts The paths for working out the nesting level.
 * @returns The nesting level of the function.
 */
function getFunctionNestingLevel({
	from,
	relativeTo = functionsDir,
}: RelativePathOpts): number {
	let nestingLevel = -1;

	try {
		const relativePath = relative(from, relativeTo);
		nestingLevel = relativePath.split('..').length - 1;
	} catch {
		/* empty */
	}

	if (nestingLevel < 0) {
		throw new Error(
			`Error: could not determine nesting level of the following function: ${from}`
		);
	}

	return nestingLevel;
}

type RelativePathOpts = {
	from: string;
	relativeTo?: string;
};

// Chunks can contain `require("node:*")`, this is not allowed and breaks at runtime
// the following fixes this by updating the require to a standard esm import from "node:*"
export const nodeBuiltInModulesPlugin: Plugin = {
	name: 'node:built-in:modules',
	setup(build) {
		build.onResolve({ filter: /^node:/ }, ({ kind, path }) => {
			// this plugin converts `require("node:*")` calls, those are the only ones that
			// need updating (esm imports to "node:*" are totally valid), so here we tag with the
			// node-buffer namespace only imports that are require calls
			return kind === 'require-call'
				? { path, namespace: 'node-built-in-modules' }
				: undefined;
		});

		// we convert the imports we tagged with the node-built-in-modules namespace so that instead of `require("node:*")`
		// they import from `export * from "node:*";`
		build.onLoad(
			{ filter: /.*/, namespace: 'node-built-in-modules' },
			({ path }) => {
				return {
					contents: `export * from '${path}'`,
					loader: 'js',
				};
			}
		);
	},
};
