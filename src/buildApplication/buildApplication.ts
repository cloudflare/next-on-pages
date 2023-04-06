import { exit } from 'process';
import { resolve } from 'path';
import { cliError, cliLog, CliOptions } from '../cli';
import {
	getParsedMiddlewareManifest,
	MiddlewareManifestData,
} from './middlewareManifest';
import { getNextJsConfigs } from './nextJsConfigs';
import { getVercelConfig } from './getVercelConfig';
import { buildWorkerFile } from './buildWorkerFile';
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

/**
 * Builds the _worker.js with static assets implementing the Next.js application
 *
 * @param options options for the build
 */
export async function buildApplication({
	skipBuild,
	experimentalMinify,
}: Pick<CliOptions, 'skipBuild' | 'experimentalMinify'>) {
	let buildSuccess = true;
	if (!skipBuild) {
		try {
			await buildVercelOutput();
		} catch (err) {
			cliError(err.message);
			buildSuccess = false;
		}
	}

	if (!buildSuccess) return;

	await deleteNextTelemetryFiles();

	await prepareAndBuildWorker({ experimentalMinify });
	await buildMetadataFiles();
}

async function prepareAndBuildWorker(
	options: Pick<CliOptions, 'experimentalMinify'>
): Promise<void> {
	let vercelConfig: VercelConfig;
	try {
		vercelConfig = await getVercelConfig();
	} catch (e) {
		if (e instanceof Error) {
			cliError(e.message, true);
		}
		exit(1);
	}

	const nextJsConfigs = await getNextJsConfigs();

	if (nextJsConfigs.basePath) {
		cliLog(`Using basePath ${nextJsConfigs.basePath}`);
	}

	const functionsDir = resolve(`.vercel/output/functions`);
	if (!(await validateDir(functionsDir))) {
		cliLog('No functions detected.');
		return;
	}

	const { invalidFunctions, functionsMap } = await generateFunctionsMap(
		functionsDir,
		options.experimentalMinify
	);

	if (functionsMap.size === 0) {
		cliLog('No functions detected.');
		return;
	}

	// NOTE: Middleware manifest logic will be removed in the new routing system.
	let middlewareManifestData: MiddlewareManifestData;

	try {
		middlewareManifestData = await getParsedMiddlewareManifest(
			functionsMap,
			nextJsConfigs
		);
	} catch (e: unknown) {
		if (e instanceof Error) {
			cliError(e.message, true);
		}
		exit(1);
	}

	if (invalidFunctions.size > 0) {
		printInvalidFunctionsErrorMessage(Array.from(invalidFunctions));
		exit(1);
	}

	const staticAssets = await getVercelStaticAssets();

	const processedVercelOutput = processVercelOutput(
		vercelConfig,
		staticAssets,
		middlewareManifestData
	);

	await buildWorkerFile(
		processedVercelOutput,
		nextJsConfigs,
		options.experimentalMinify
	);
}

function printInvalidFunctionsErrorMessage(invalidFunctions: string[]): void {
	cliError(`
		ERROR: Failed to produce a Cloudflare Pages build from the project.

		The following functions were not configured to run with the Edge Runtime:
		${invalidFunctions.map(fn => ` - ${fn}`).join('\n')}

		If this is a Next.js project:

		- you can read more about configuring Edge API Routes here: https://nextjs.org/docs/api-routes/edge-api-route
		
		- you can try enabling the Edge Runtime for a specific page by exporting the following from your page:

		        export const config = { runtime: 'edge' };

		- or you can try enabling the Edge Runtime for all pages in your project by adding the following to your 'next.config.js' file:

		        const nextConfig = { experimental: { runtime: 'edge'} };

		You can read more about the Edge Runtime here: https://nextjs.org/docs/advanced-features/react-18/switchable-runtime
	`);
}
