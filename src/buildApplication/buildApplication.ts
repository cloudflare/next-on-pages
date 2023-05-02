import { exit } from 'process';
import { resolve } from 'path';
import type { CliOptions } from '../cli';
import { cliError, cliLog } from '../cli';
import { getVercelConfig } from './getVercelConfig';
import { buildWorkerFile } from './buildWorkerFile';
import type { DirectoryProcessingResults } from './generateFunctionsMap';
import { generateFunctionsMap } from './generateFunctionsMap';
import {
	buildVercelOutput,
	deleteNextTelemetryFiles,
} from './buildVercelOutput';
import { buildMetadataFiles } from './buildMetadataFiles';
import { validateDir } from '../utils';
import {
	getVercelStaticAssets,
	processVercelOutput,
} from './processVercelOutput';
import { getCurrentPackageExecuter } from './packageManagerUtils';

/**
 * Builds the _worker.js with static assets implementing the Next.js application
 *
 * @param options options for the build
 */
export async function buildApplication({
	skipBuild,
	disableChunksDedup,
	disableWorkerMinification,
}: Pick<
	CliOptions,
	'skipBuild' | 'disableChunksDedup' | 'disableWorkerMinification'
>) {
	let buildSuccess = true;
	if (!skipBuild) {
		try {
			await buildVercelOutput();
		} catch {
			cliError(
				`
					The Vercel build (\`${await getCurrentPackageExecuter()} vercel build\`) command failed. For more details see the Vercel logs above.
					If you need help solving the issue, refer to the Vercel or Next.js documentation or their repositories.
				`,
				{ spaced: true }
			);
			buildSuccess = false;
		}
	}

	if (!buildSuccess) return;

	await deleteNextTelemetryFiles();

	await prepareAndBuildWorker({
		disableChunksDedup,
		disableWorkerMinification,
	});
	await buildMetadataFiles();
}

async function prepareAndBuildWorker(
	options: Pick<CliOptions, 'disableChunksDedup' | 'disableWorkerMinification'>
): Promise<void> {
	let vercelConfig: VercelConfig;
	try {
		vercelConfig = await getVercelConfig();
	} catch (e) {
		if (e instanceof Error) {
			cliError(e.message, { showReport: true });
		}
		exit(1);
	}

	let generatedFunctionsMaps: DirectoryProcessingResults | undefined;

	const functionsDir = resolve('.vercel', 'output', 'functions');
	if (!(await validateDir(functionsDir))) {
		cliLog('No functions detected (Vercel didn't generate a functions directory).');
	} else {
		generatedFunctionsMaps = await generateFunctionsMap(
			functionsDir,
			options.disableChunksDedup
		);

		if (generatedFunctionsMaps.invalidFunctions.size > 0) {
			printInvalidFunctionsErrorMessage(
				Array.from(generatedFunctionsMaps.invalidFunctions)
			);
			exit(1);
		}

		if (generatedFunctionsMaps.functionsMap.size === 0) {
			cliLog('No functions detected.');
		}
	}

	const staticAssets = await getVercelStaticAssets();

	const processedVercelOutput = processVercelOutput(
		vercelConfig,
		staticAssets,
		generatedFunctionsMaps?.prerenderedRoutes,
		generatedFunctionsMaps?.functionsMap
	);

	await buildWorkerFile(
		processedVercelOutput,
		!options.disableWorkerMinification
	);
}

function printInvalidFunctionsErrorMessage(invalidFunctions: string[]): void {
	cliError(
		`
		ERROR: Failed to produce a Cloudflare Pages build from the project.

			The following functions were not configured to run with the Edge Runtime:\n${invalidFunctions
				.map(fn => `				- ${fn}`)
				.join('\n')}

			If this is a Next.js project:

			- you can read more about configuring Edge API Routes here: https://nextjs.org/docs/api-routes/edge-api-route
			
			- you can try enabling the Edge Runtime for a specific page by exporting the following from your page:

					export const config = { runtime: 'edge' };

			- or you can try enabling the Edge Runtime for all pages in your project by adding the following to your 'next.config.js' file:

					const nextConfig = { experimental: { runtime: 'edge'} };

			You can read more about the Edge Runtime here: https://nextjs.org/docs/advanced-features/react-18/switchable-runtime
	`,
		{ spaced: true }
	);
}
