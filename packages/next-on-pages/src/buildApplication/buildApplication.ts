import { exit } from 'process';
import { join, resolve } from 'path';
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
import {
	getCurrentPackageExecuter,
	getPackageVersion,
} from './packageManagerUtils';
import { gtr as versionGreaterThan, coerce } from 'semver';
import { printBuildSummary, writeBuildInfo } from './buildSummary';

/**
 * Builds the _worker.js with static assets implementing the Next.js application
 *
 * @param options options for the build
 */
export async function buildApplication({
	skipBuild,
	disableChunksDedup,
	disableWorkerMinification,
	watch,
}: Pick<
	CliOptions,
	'skipBuild' | 'disableChunksDedup' | 'disableWorkerMinification' | 'watch'
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

	if (!buildSuccess) {
		if (!watch) exit(1);
		return;
	}

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
		cliLog(
			'No functions detected (no functions directory generated by Vercel).'
		);
	} else {
		generatedFunctionsMaps = await generateFunctionsMap(
			functionsDir,
			options.disableChunksDedup
		);

		if (generatedFunctionsMaps.invalidFunctions.size > 0) {
			await printInvalidFunctionsErrorMessage(
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

	printBuildSummary(staticAssets, generatedFunctionsMaps);
	await writeBuildInfo(
		join('.vercel', 'output', 'static', '_worker.js'),
		staticAssets,
		generatedFunctionsMaps
	);

	await buildWorkerFile(
		processedVercelOutput,
		!options.disableWorkerMinification
	);
}

async function printInvalidFunctionsErrorMessage(
	invalidFunctions: string[]
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

	const invalidRoutes = Array.from(
		new Set(invalidFunctions.map(fn => fn.replace(/(\.rsc)?\.func$/, '')))
	);

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
