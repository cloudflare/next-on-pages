import { exit } from 'process';
import { join, resolve } from 'path';
import { cp } from 'fs/promises';
import { getPackageManager } from 'package-manager-manager';
import type { CliOptions } from '../cli';
import { cliError, cliLog, cliSuccess } from '../cli';
import { getVercelConfig } from './getVercelConfig';
import { buildWorkerFile } from './buildWorkerFile';
import { buildVercelOutput } from './buildVercelOutput';
import { buildMetadataFiles } from './buildMetadataFiles';
import { validateDir } from '../utils';
import {
	getVercelStaticAssets,
	processVercelOutput,
	processOutputDir,
} from './processVercelOutput';
import { printBuildSummary, writeBuildInfo } from './buildSummary';
import type { ProcessedVercelFunctions } from './processVercelFunctions';
import { processVercelFunctions } from './processVercelFunctions';

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
	outdir: outputDir,
}: Pick<
	CliOptions,
	| 'skipBuild'
	| 'disableChunksDedup'
	| 'disableWorkerMinification'
	| 'watch'
	| 'outdir'
>) {
	const pm = await getPackageManager();

	if (!pm) {
		throw new Error('Error: Could not detect current package manager in use');
	}

	let buildSuccess = true;
	if (!skipBuild) {
		try {
			await buildVercelOutput(pm);
		} catch {
			const execStr = await pm.getRunExec('vercel', {
				args: ['build'],
				download: 'prefer-if-needed',
			});
			cliError(
				`
					The Vercel build ${
						execStr ? `(\`${execStr}\`) ` : ''
					}command failed. For more details see the Vercel logs above.
					If you need help solving the issue, refer to the Vercel or Next.js documentation or their repositories.
				`,
				{ spaced: true },
			);
			buildSuccess = false;
		}
	}

	if (!buildSuccess) {
		if (!watch) exit(1);
		return;
	}

	const buildStartTime = Date.now();

	await prepareAndBuildWorker(outputDir, {
		disableChunksDedup,
		disableWorkerMinification,
	});

	const totalBuildTime = ((Date.now() - buildStartTime) / 1000).toFixed(2);
	cliLog(`Build completed in ${totalBuildTime.toLocaleString()}s`);
}

async function prepareAndBuildWorker(
	outputDir: string,
	{
		disableChunksDedup,
		disableWorkerMinification,
	}: Pick<CliOptions, 'disableChunksDedup' | 'disableWorkerMinification'>,
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

	const staticAssets = await getVercelStaticAssets();

	await processOutputDir(outputDir, staticAssets);

	let processedFunctions: ProcessedVercelFunctions | undefined;

	const functionsDir = resolve('.vercel', 'output', 'functions');
	if (!(await validateDir(functionsDir))) {
		cliLog(
			'No functions detected (no functions directory generated by Vercel).',
		);
	} else {
		const workerJsDir = join(outputDir, '_worker.js');
		processedFunctions = await processVercelFunctions({
			functionsDir,
			outputDir,
			workerJsDir,
			nopDistDir: join(workerJsDir, '__next-on-pages-dist__'),
			disableChunksDedup,
			vercelConfig,
		});
	}

	const processedVercelOutput = processVercelOutput(
		vercelConfig,
		staticAssets,
		processedFunctions?.collectedFunctions?.prerenderedFunctions,
		processedFunctions?.collectedFunctions?.edgeFunctions,
	);

	const outputtedWorkerPath = await buildWorkerFile(
		processedVercelOutput,
		outputDir,
		!disableWorkerMinification,
	);

	await buildMetadataFiles(outputDir, { staticAssets });

	const noNodejsStaticErrorPageFileName = await copyNoNodejsCompatStaticErrorPage(outputDir);
	staticAssets.push(`/${noNodejsStaticErrorPageFileName}`);

	printBuildSummary(staticAssets, processedVercelOutput, processedFunctions);

	await writeBuildInfo(
		join(outputDir, '_worker.js'),
		staticAssets,
		processedVercelOutput,
		processedFunctions,
	);

	cliSuccess(`Generated '${outputtedWorkerPath}'.`);
}

/**
 * Copies the no nodejs_compat static error page to the output directory
 *
 * @param outputDir path of the output directory
 * @returns the filename of the html file copied
 */
async function copyNoNodejsCompatStaticErrorPage(outputDir: string): Promise<string> {
	const htmlFileName = 'no-nodejs-compat-flag-error-page.html';
	const noNodejsCompatFlagStaticErrorPagePath = join(__dirname, '..', 'no-nodejs-compat-flag-static-error-page', 'dist' ,'index.html');
	await cp(noNodejsCompatFlagStaticErrorPagePath, join(outputDir, htmlFileName));
	return htmlFileName;
}
