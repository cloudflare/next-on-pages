import 'server-only';
import dedent from 'dedent-tabs';

declare global {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface CloudflareEnv {}
}

type RequestContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
> = {
	env: CloudflareEnv;
	cf: CfProperties;
	ctx: Context;
};

const cloudflareRequestContextSymbol = Symbol.for(
	'__cloudflare-request-context__',
);

const notEdgeRuntimeErrorMessage = dedent`
\`getRequestContext\` and \`getOptionalRequestContext\` can only be run inside the edge runtime,
so please make sure to have included \`export const runtime = 'edge'\`
in all the routes using such function (regardless of whether they are used directly or through imports).
`;

export function getOptionalRequestContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(): undefined | RequestContext<CfProperties, Context> {
	const cloudflareRequestContext = (
		globalThis as unknown as {
			[cloudflareRequestContextSymbol]:
				| RequestContext<CfProperties, Context>
				| undefined;
		}
	)[cloudflareRequestContextSymbol];

	const insideEdge = isInsideEdgeRuntime();
	if (insideEdge === false) {
		// no matter what, we want to throw if either
		// `getRequestContext` or `getOptionalRequestContext`
		// is run in the Node.js runtime
		throw new Error(notEdgeRuntimeErrorMessage);
	}

	return cloudflareRequestContext;
}

export function getRequestContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(): RequestContext<CfProperties, Context> {
	const cloudflareRequestContext = getOptionalRequestContext<
		CfProperties,
		Context
	>();

	if (!cloudflareRequestContext) {
		let errorMessage = 'Failed to retrieve the Cloudflare request context.';

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		if (process.env.NODE_ENV === 'development') {
			errorMessage +=
				'\n\n' +
				dedent`
					For local development (using the Next.js dev server) remember to include
					a call to the \`setupDevPlatform\` function in your config file.
				` +
				(isInsideEdgeRuntime() === 'maybe'
					? dedent`\n
				Please also keep in mind that ${notEdgeRuntimeErrorMessage}
				`
					: '') +
				dedent`\n
					For more details visit:
					https://github.com/cloudflare/next-on-pages/tree/3846730c/internal-packages/next-dev
				` +
				'\n\n';
		}

		throw new Error(errorMessage);
	}

	return cloudflareRequestContext;
}

/**
 * detects whether the current code is running inside the (local) edge runtime or not
 *
 * @returns a boolean indicating whether the code is running inside the edge runtime if that can be accurately detected,
 * 			'maybe' if the code is likely being run inside the edge runtime but we're not 100% sure of that
 */
function isInsideEdgeRuntime(): boolean | 'maybe' {
	try {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		process.cwd();
	} catch (error) {
		if (error instanceof Error) {
			// When certain Node.js APIs are being used the Next dev server errors with a message such as:
			//    "A Node.js API is used (...) which is not supported in the Edge Runtime"
			// we can rely on such error in order to discern accurately if we are or not in the edge runtime
			// (source: https://github.com/vercel/next.js/blob/0fe68736/packages/next/src/server/web/sandbox/context.ts#L118-L122)
			const notSupportedInEdgeError = error.message.includes(
				'is not supported in the Edge Runtime',
			);
			if (!notSupportedInEdgeError) {
				return true;
			}
		}
		// an error was thrown... likely we are in the edge runtime, but there's no real guarantee
		return 'maybe';
	}

	// for the time being we can safely assume that if `process.cwd()` doesn't error
	// than that means that we're in the Node.js runtime
	return false;
}
