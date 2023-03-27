import { stat } from 'fs/promises';
import { exit } from 'process';
import { resolve } from 'path';
import { cliError, cliLog, CliOptions } from '../cli';
import {
	getParsedMiddlewareManifest,
	MiddlewareManifestData,
} from './middlewareManifest';
import { getNextConfigs } from './nextConfigs';
import { getVercelConfig, VercelConfig } from './vercelConfig';
import { buildWorkerFile } from './buildWorkerFile';
import { generateFunctionsMap } from './generateFunctionsMap';
import { buildVercelOutput } from './buildVercelOutput';
import { buildMetadataFiles } from './buildMetadataFiles';

/**
 * Builds the _worker.js with static assets implementing the Next.js application
 *
 * @param options options for the build
 */
export async function buildApplication({
	skipBuild,
	experimentalMinify,
}: Pick<CliOptions, 'skipBuild' | 'experimentalMinify'>) {
	if (!skipBuild) {
		await buildVercelOutput();
	}

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

	const nextConfigs = await getNextConfigs();

	if (nextConfigs.basePath) {
		cliLog(`Using basePath ${nextConfigs.basePath}`);
	}

	const functionsDir = resolve(
		`.vercel/output/functions${nextConfigs.basePath ?? ''}`
	);
	let functionsExist = false;
	try {
		await stat(functionsDir);
		functionsExist = true;
	} catch {
		/* empty */
	}

	if (!functionsExist) {
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

	let middlewareManifestData: MiddlewareManifestData;

	try {
		middlewareManifestData = await getParsedMiddlewareManifest(functionsMap);
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

	await buildWorkerFile(
		middlewareManifestData,
		vercelConfig,
		nextConfigs,
		options
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
