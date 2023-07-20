import { gtr as versionGreaterThan, coerce } from 'semver';
import { cliError } from '../../cli';
import { getPackageVersion } from '../packageManagerUtils';
import { stripFuncExtension } from '../../utils';
import type { CollectedFunctions, FunctionInfo } from './configs';

/**
 * Checks if there are any invalid functions from the Vercel build output.
 *
 * If there are any invalid functions, an error message will be printed and the process will exit.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 */
export async function checkForInvalidFunctions(
	collectedFunctions: CollectedFunctions,
): Promise<void> {
	if (collectedFunctions.invalidFunctions.size > 0) {
		await printInvalidFunctionsErrorMessage(
			collectedFunctions.invalidFunctions,
		);
		process.exit(1);
	}
}

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
