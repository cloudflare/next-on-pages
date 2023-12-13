import { gtr as versionGreaterThan } from 'semver';
import { cliError, cliWarn } from '../../cli';
import { getPackageManager } from 'package-manager-manager';
import {
	formatRoutePath,
	getPackageVersionOrNull,
	stripFuncExtension,
} from '../../utils';
import type { CollectedFunctions, FunctionInfo } from './configs';
import { join } from 'path';
import type { ProcessVercelFunctionsOpts } from '.';
import { isUsingAppRouter, isUsingPagesRouter } from '../getVercelConfig';

type InvalidFunctionsOpts = Pick<
	ProcessVercelFunctionsOpts,
	'functionsDir' | 'vercelConfig'
>;

/**
 * Checks if there are any invalid functions from the Vercel build output.
 *
 * If there are any invalid functions it will try to see if they are amendable and if the
 * build output can still be used.
 *
 * If however the build output can't be used, an error message will be printed and the process will exit.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 * @param opts Options for processing Vercel functions.
 */
export async function checkInvalidFunctions(
	collectedFunctions: CollectedFunctions,
	opts: InvalidFunctionsOpts,
): Promise<void> {
	const usingAppRouter = isUsingAppRouter(opts.vercelConfig);
	const usingPagesRouter = isUsingPagesRouter(opts.vercelConfig);

	if (usingAppRouter && !usingPagesRouter) {
		await tryToFixAppRouterNotFoundFunction(collectedFunctions);
		await fixAppRouterInvalidErrorFunctions(collectedFunctions);
	}

	await tryToFixI18nFunctions(collectedFunctions, opts);

	await tryToFixInvalidFuncsWithValidIndexAlternative(collectedFunctions);

	if (collectedFunctions.invalidFunctions.size > 0) {
		await printInvalidFunctionsErrorMessage(
			collectedFunctions.invalidFunctions,
		);
		process.exit(1);
	}
}

/**
 * Tries to fix potential not-found invalid functions from the Vercel build output.
 *
 * Static app/not-found.(jsx|tsx) pages generate an _not-found.func serverless function,
 * that can be removed as we can fallback to the statically generated 404 page
 *
 * If the app/not-found.(jsx|tsx) contains runtime logic alongside the _not-found.func serverless
 * function also an _error.func will be generated, in such a case we can only warn the user about
 * it.
 * (
 *  That's the only option because:
 *    - removing the _not-found.func and _error.func doesn't result in a working application
 *    - we don't have a guarantee that the _error.func hasn't been generated by something else
 *      and that the _not-found.func is that of a static app/not-found route
 * )
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 */
async function tryToFixAppRouterNotFoundFunction({
	invalidFunctions,
	ignoredFunctions,
}: CollectedFunctions): Promise<void> {
	for (const [fullPath, fnInfo] of invalidFunctions.entries()) {
		const notFoundFuncName = '/_not-found.func';
		const errorFuncName = '/_error.func';

		const invalidNotFound = fullPath.endsWith(notFoundFuncName);
		const invalidError = invalidFunctions.get(
			fullPath.replace(notFoundFuncName, errorFuncName),
		);

		if (invalidNotFound && !invalidError) {
			ignoredFunctions.set(fullPath, {
				reason: 'invalid unnecessary not-found function',
				...fnInfo,
			});
			invalidFunctions.delete(fullPath);

			const notFoundRscDir = fullPath.replace(/\.func$/, '.rsc.func');
			const rscVersionFnInfo = invalidFunctions.get(notFoundRscDir);
			if (rscVersionFnInfo) {
				ignoredFunctions.set(notFoundRscDir, {
					reason: 'invalid unnecessary not-found function',
					...rscVersionFnInfo,
				});
				invalidFunctions.delete(notFoundRscDir);
			}
		}

		if (invalidNotFound && invalidError) {
			cliWarn(`
				Warning: your app/not-found route might contain runtime logic, this is currently
				not supported by @cloudflare/next-on-pages, if that's actually the case please
				remove the runtime logic from your not-found route
			`);
		}

		if (invalidNotFound) {
			break;
		}
	}
}

/**
 * In the App router, error boundaries are implemented as client components
 * (see: https://nextjs.org/docs/app/api-reference/file-conventions/error), meaning that they
 * should not produce server side logic.
 *
 * The Vercel build process can however generate _error.func lambdas (as they are useful in the
 * Vercel network I'd assume), through experimentation we've seen that those do not seem to be
 * necessary when building the application with next-on-pages so they should be safe to ignore.
 *
 * This function makes such invalid _error.func lambdas (if present) ignored (as they would otherwise
 * cause the next-on-pages build process to fail).
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 */
async function fixAppRouterInvalidErrorFunctions({
	invalidFunctions,
	ignoredFunctions,
}: CollectedFunctions): Promise<void> {
	for (const [fullPath, fnInfo] of invalidFunctions.entries()) {
		if (fullPath.endsWith('/_error.func')) {
			ignoredFunctions.set(fullPath, {
				reason: 'invalid _error functions in app directory are ignored',
				...fnInfo,
			});
			invalidFunctions.delete(fullPath);
		}
	}
}

/**
 * Tries to fix potential unnecessary and invalid i18n functions from the Vercel build output.
 *
 * This is a workaround for Vercel creating invalid Node.js i18n functions in the build output, and
 * is achieved by combing through the Vercel build output config to find i18n keys that match the
 * invalid functions.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 * @param opts Options for processing Vercel functions.
 */
async function tryToFixI18nFunctions(
	{ edgeFunctions, invalidFunctions, ignoredFunctions }: CollectedFunctions,
	{ vercelConfig, functionsDir }: InvalidFunctionsOpts,
): Promise<void> {
	if (!invalidFunctions.size || !vercelConfig.routes?.length) {
		return;
	}

	const foundI18nKeys = vercelConfig.routes.reduce((acc, route) => {
		if ('handle' in route) return acc;

		// Matches the format used in certain source route entries in the build output config.
		// e.g. "src": "/(?<nextLocale>default|en|ja)(/.*|$)"
		/\(\?<nextLocale>([^)]+)\)/
			.exec(route.src)?.[1]
			?.split('|')
			?.forEach(locale => acc.add(locale));

		return acc;
	}, new Set<string>());

	if (!foundI18nKeys.size) {
		// no i18n keys found in the build output config, so we can't fix anything
		return;
	}

	for (const [fullPath, fnInfo] of invalidFunctions.entries()) {
		for (const i18nKey of foundI18nKeys) {
			const firstRouteSegment = stripFuncExtension(fnInfo.relativePath)
				.replace(/^\//, '')
				.split('/')[0];

			if (firstRouteSegment === i18nKey) {
				const pathWithoutI18nKey = fnInfo.relativePath
					.replace(new RegExp(`^/${i18nKey}.func`), '/index.func')
					.replace(new RegExp(`^/${i18nKey}/`), '/');
				const fullPathWithoutI18nKey = join(functionsDir, pathWithoutI18nKey);

				const edgeFn = edgeFunctions.get(fullPathWithoutI18nKey);
				if (edgeFn) {
					invalidFunctions.delete(fullPath);
					ignoredFunctions.set(fullPath, {
						reason: 'unnecessary invalid i18n function',
						...fnInfo,
					});
					edgeFn.route?.overrides?.push(formatRoutePath(fnInfo.relativePath));
				}
			}
		}
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
	const pm = await getPackageManager();
	const nextVersion = pm ? await getPackageVersionOrNull(pm, 'next') : null;

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

/**
 * Tries to fix potential invalid functions with a valid /index alternative from the Vercel build
 * output.
 *
 * This deals with an edge case when using `basePath` creates an invalid function for the
 * `/` route, but a valid alternative is created at `/index`.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 */
async function tryToFixInvalidFuncsWithValidIndexAlternative({
	edgeFunctions,
	prerenderedFunctions,
	invalidFunctions,
	ignoredFunctions,
}: CollectedFunctions) {
	for (const [fullPath, fnInfo] of invalidFunctions.entries()) {
		const withoutFuncExt = stripFuncExtension(fullPath);
		const fullPathForIndex = withoutFuncExt.endsWith('.rsc')
			? withoutFuncExt.replace(/\.rsc$/, '/index.rsc.func')
			: `${withoutFuncExt}/index.func`;

		if (
			edgeFunctions.has(fullPathForIndex) ||
			prerenderedFunctions.has(fullPathForIndex)
		) {
			ignoredFunctions.set(fullPath, {
				reason: 'invalid function with valid /index alternative',
				...fnInfo,
			});
			invalidFunctions.delete(fullPath);
		}
	}
}
