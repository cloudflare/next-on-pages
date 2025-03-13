import type { CollectedFunctions } from './configs';
import { collectFunctionConfigsRecursively } from './configs';
import { processEdgeFunctions } from './edgeFunctions';
import { processPrerenderFunctions } from './prerenderFunctions';
import type { CollectedFunctionIdentifiers } from './dedupeEdgeFunctions';
import { dedupeEdgeFunctions } from './dedupeEdgeFunctions';
import { checkInvalidFunctions } from './invalidFunctions';

/**
 * Processes and dedupes the Vercel build output functions directory.
 *
 * @param opts Options for processing Vercel functions.
 * @returns The collected functions and their identifiers.
 */
export async function processVercelFunctions(
	opts: ProcessVercelFunctionsOpts,
): Promise<ProcessedVercelFunctions> {
	const collectedFunctions = await collectFunctionConfigsRecursively(
		opts.functionsDir,
	);

	await processPrerenderFunctions(collectedFunctions, opts);

	await processEdgeFunctions(collectedFunctions);

	await checkInvalidFunctions(collectedFunctions, opts);

	const identifiers = await dedupeEdgeFunctions(collectedFunctions, opts);

	return { collectedFunctions, identifiers };
}

export type ProcessVercelFunctionsOpts = {
	functionsDir: string;
	outputDir: string;
	workerJsDir: string;
	nopDistDir: string;
	disableChunksDedup?: boolean;
	vercelConfig: VercelConfig;
	ignoreInvalidFunctions: boolean;
};

export type ProcessedVercelFunctions = {
	collectedFunctions: CollectedFunctions;
	identifiers: CollectedFunctionIdentifiers;
};
