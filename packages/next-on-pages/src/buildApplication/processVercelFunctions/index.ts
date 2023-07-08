/* eslint-disable no-console */
/**
 * Goals:
 *
 * - Simplified and more readable code
 * - Improved performance
 * - Only parsing the AST once per Edge function
 *
 * Structure:
 *
 * 1. Collect list of functions from directory. ✅
 * 2. Process Prerender functions. ✅
 * 3. Process Edge functions. ✅
 * 4. Check for invalid functions. ✅
 * 5. Modify Edge functions (goal: only parse to an AST once per Edge function).
 * 5.1. Apply regex-based fixes to contents. ✅
 * 5.2. Extract Wasm, Webpack chunks, and manifest identifiers from AST. ✅
 * 5.3. Dedupe the extracted identifiers.
 * 5.2.1. Write Wasm to disk. ❌
 * 5.2.2. Write bundled assets to disk. ❌
 * 5.3.1. Write manifests to disk. ❌
 * 5.3.2. Write Webpack chunks to disk, grouped by the functions they're used in. ❌
 *
 */

import { gtr as versionGreaterThan, coerce } from 'semver';
import { cliError } from '../../cli';
import type { FunctionInfo } from './configs';
import { collectFunctionConfigsRecursively } from './configs';
import { processEdgeFunctions } from './edgeFunctions';
import { processPrerenderFunctions } from './prerenderFunctions';
import { timer } from './temp';
import { getPackageVersion } from '../packageManagerUtils';
import { stripFuncExtension } from '../../utils';
import { dedupeEdgeFunctions } from './dedupeEdgeFunctions';

export type ProcessVercelFunctionsOpts = {
	functionsDir: string;
	outputDir: string;
	disableChunksDedup?: boolean;
};

export async function processVercelFunctions(opts: ProcessVercelFunctionsOpts) {
	const collectConfigsTimer = timer('collect function configs');
	const collectedFunctions = await collectFunctionConfigsRecursively(
		opts.functionsDir
	);
	collectConfigsTimer.stop();

	const processPrerenderFunctionsTimer = timer('process prerender functions');
	await processPrerenderFunctions(collectedFunctions, opts);
	processPrerenderFunctionsTimer.stop();

	const processEdgeFunctionsTimer = timer('process edge functions');
	await processEdgeFunctions(collectedFunctions);
	processEdgeFunctionsTimer.stop();

	console.log();
	console.log('Edge:     ', collectedFunctions.edgeFunctions.size);
	console.log('Prerender:', collectedFunctions.prerenderedFunctions.size);
	console.log('Invalid:  ', collectedFunctions.invalidFunctions.size);
	console.log();

	if (collectedFunctions.invalidFunctions.size > 0) {
		await printInvalidFunctionsErrorMessage(
			collectedFunctions.invalidFunctions
		);
		process.exit(1);
	}

	const dedupeEdgeFunctionsTimer = timer('dedupe edge functions');
	await dedupeEdgeFunctions(collectedFunctions, opts);
	dedupeEdgeFunctionsTimer.stop();

	// const nopDistDir = join(outputDir, '_worker.js', '__next-on-pages-dist__');
}

/**
 * Prints an error message for the invalid functions from the Vercel build output.
 *
 * @param invalidFunctions Invalid functions found in the Vercel build output.
 */
async function printInvalidFunctionsErrorMessage(
	invalidFunctions: Map<string, FunctionInfo>
): Promise<void> {
	const nextVersion = coerce(await getPackageVersion('next'));

	const { exportText, exampleCode } =
		!nextVersion || versionGreaterThan(nextVersion, '13.1.2')
			? {
					exportText: 'the following edge runtime route segment config',
					exampleCode: "export const runtime = 'edge';",
			  }
			: {
					exportText: 'a config object specifying the edge runtime, like',
					exampleCode: "export const config = { runtime: 'edge' };",
			  };

	const invalidRoutes = [
		...new Set(
			[...invalidFunctions.values()].map(fn =>
				stripFuncExtension(fn.relativePath).replace(/\.rsc$/, '')
			)
		),
	];

	cliError(
		`
		ERROR: Failed to produce a Cloudflare Pages build from the project.

			The following routes were not configured to run with the Edge Runtime:\n${invalidRoutes
				.map(route => `			  - ${route}`)
				.join('\n')}

			Please make sure that all your non-static routes export ${exportText}:
			  ${exampleCode}

			You can read more about the Edge Runtime on the Next.js documentation:
			  https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes
	`,
		{ spaced: true }
	);
}
