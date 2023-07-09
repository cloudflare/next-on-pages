import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { nodeBuiltInModulesPlugin } from '../generateFunctionsMap';

export async function buildFile(
	contents: string,
	filePath: string,
	relativeTo?: string
) {
	const relativeNopDistPath = join(
		getRelativePath(filePath, relativeTo),
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

export function getRelativePath(
	functionPath: string,
	relativeTo?: string
): string {
	return '../'.repeat(getFunctionNestingLevel(functionPath, relativeTo));
}

const functionsDir = resolve('.vercel', 'output', 'functions');
function getFunctionNestingLevel(
	functionPath: string,
	relativeTo = functionsDir
): number {
	let nestingLevel = -1;

	try {
		const relativePath = relative(functionPath, relativeTo);
		nestingLevel = relativePath.split('..').length - 1;
	} catch {
		/* empty */
	}

	if (nestingLevel < 0) {
		throw new Error(
			`Error: could not determine nesting level of the following function: ${functionPath}`
		);
	}

	return nestingLevel;
}
