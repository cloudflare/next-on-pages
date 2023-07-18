import { gtr as versionGreaterThan, coerce } from 'semver';
import { cliError } from '../../cli';
import type { CollectedFunctions, FunctionInfo } from './configs';
import { collectFunctionConfigsRecursively } from './configs';
import { processEdgeFunctions } from './edgeFunctions';
import { processPrerenderFunctions } from './prerenderFunctions';
import { getPackageVersion } from '../packageManagerUtils';
import { stripFuncExtension } from '../../utils';
import type { CollectedFunctionIdentifiers } from './dedupeEdgeFunctions';
import { dedupeEdgeFunctions } from './dedupeEdgeFunctions';

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

	if (collectedFunctions.invalidFunctions.size > 0) {
		await printInvalidFunctionsErrorMessage(
			collectedFunctions.invalidFunctions,
		);
		process.exit(1);
	}

	const identifiers = await dedupeEdgeFunctions(collectedFunctions, opts);

	return { collectedFunctions, identifiers };
}

export type ProcessVercelFunctionsOpts = {
	functionsDir: string;
	outputDir: string;
	workerJsDir: string;
	nopDistDir: string;
	disableChunksDedup?: boolean;
};

export type ProcessedVercelFunctions = {
	collectedFunctions: CollectedFunctions;
	identifiers: CollectedFunctionIdentifiers;
};

/**
 * Prints an error message for the invalid functions from the Vercel build output.
 *
 * @param invalidFunctions Invalid functions found in the Vercel build output.
 */
async function printInvalidFunctionsErrorMessage(
	invalidFunctions: Map<string, FunctionInfo>,
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
				stripFuncExtension(fn.relativePath).replace(/\.rsc$/, ''),
			),
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
		{ spaced: true },
	);
}
