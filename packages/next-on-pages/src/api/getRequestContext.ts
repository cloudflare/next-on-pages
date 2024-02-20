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

					For more details visit:
					  https://github.com/cloudflare/next-on-pages/tree/3846730c/internal-packages/next-dev
				` +
				'\n\n';
		}

		throw new Error(errorMessage);
	}

	return cloudflareRequestContext;
}
