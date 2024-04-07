import type { Plugin } from 'esbuild';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { normalizePath } from '../../utils';

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
	{ relativeTo }: Omit<RelativePathOpts, 'from'> = {},
) {
	const relativeNopDistPath = normalizePath(
		join(
			getRelativePathToAncestor({ from: filePath, relativeTo }),
			'__next-on-pages-dist__',
		),
	);

	await mkdir(dirname(filePath), { recursive: true });
	await build({
		stdin: { contents },
		target: 'es2022',
		platform: 'neutral',
		outfile: filePath,
		bundle: true,
		external: ['node:*', `${relativeNopDistPath}/*`, '*.wasm', 'cloudflare:*'],
		minify: true,
		plugins: [builtInModulesPlugin],
	});
}

/**
 * Gets the relative path of a function relative to a given path.
 *
 * @param opts The paths for working out the relative path.
 * @returns The relative path of the function.
 */
export function getRelativePathToAncestor(opts: RelativePathOpts): string {
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
			`Error: could not determine nesting level of the following function: ${from}`,
		);
	}

	return nestingLevel;
}

type RelativePathOpts = {
	from: string;
	relativeTo?: string;
};

/**
 * Chunks can contain dynamic require statements for built-in modules. This is not allowed and
 * breaks at runtime. The following fixes this by updating the dynamic require to a standard esm
 * import from the built-in module.
 *
 * This applies to `require("node:*")` and `require("cloudflare:*")`.
 */
export const builtInModulesPlugin: Plugin = {
	name: 'built-in:modules',
	setup(build) {
		build.onResolve({ filter: /^(node|cloudflare):/ }, ({ kind, path }) => {
			/**
			 * This plugin converts `require("prefix:*")` calls, those are the only ones that need
			 * updating (esm imports to "prefix:*" are totally valid), so here we tag with the
			 * built-in-modules namespace only imports that are require calls.
			 */
			return kind === 'require-call'
				? { path, namespace: 'built-in-modules' }
				: undefined;
		});

		/**
		 * We convert the imports we tagged with the built-in-modules namespace so that instead of
		 * `require("prefix:*")` they import from `export * from "prefix:*";`
		 */
		build.onLoad(
			{ filter: /.*/, namespace: 'built-in-modules' },
			({ path }) => {
				return {
					contents: `export * from '${path}'`,
					loader: 'js',
				};
			},
		);
	},
};
