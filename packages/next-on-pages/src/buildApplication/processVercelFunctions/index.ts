/**
 * Goals:
 *
 * - Simplified and more readable code
 * - Improved performance
 * - Only parsing the AST once per Edge function
 *
 * Structure:
 *
 * 1. Collect list of functions from directory.
 * 2. Process Prerender functions.
 * 3. Check for invalid functions.
 * 4. Process Edge functions (goal: only parse to an AST once per Edge function).
 * 4.1. Extract and dedupe Wasm + bundled assets.
 * 4.1.1. Write Wasm to disk.
 * 4.1.2. Write bundled assets to disk.
 * 4.2. Extract and dedupe Webpack chunks + manifests.
 * 4.2.1. Write manifests to disk.
 * 4.2.2. Write Webpack chunks to disk, grouped by the functions they're used in.
 * 4.3. Apply regex-based fixes to contents.
 *
 */

import { collectFunctionConfigsRecursively } from './configs';
import { processPrerenderFunctions } from './prerenderFunctions';
import { timer } from './temp';

export type ProcessVercelFunctionsOpts = {
	functionsDir: string;
	outputDir: string;
	disableChunksDedup?: boolean;
};

export async function processVercelFunctions(opts: ProcessVercelFunctionsOpts) {
	const collectConfigsTimer = timer('collect function configs');
	const functionData = await collectFunctionConfigsRecursively(
		opts.functionsDir
	);
	collectConfigsTimer.stop();

	console.log(functionData.edgeFunctions.size);
	console.log(functionData.prerenderedFunctions.size);
	console.log(functionData.invalidFunctions.size);

	const processPrerenderFunctionsTimer = timer('process prerender functions');
	await processPrerenderFunctions(functionData, opts);
	processPrerenderFunctionsTimer.stop();

	console.log(functionData.edgeFunctions.size);
	console.log(functionData.prerenderedFunctions.size);
	console.log(functionData.invalidFunctions.size);

	// const nopDistDir = join(outputDir, '_worker.js', '__next-on-pages-dist__');
}
