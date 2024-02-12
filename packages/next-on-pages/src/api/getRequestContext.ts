import 'server-only';

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

export function getRequestContext<
	CfProperties extends Record<string, unknown> = IncomingRequestCfProperties,
	Context = ExecutionContext,
>(): RequestContext<CfProperties, Context> {
	const cloudflareRequestContext = (
		globalThis as unknown as {
			[cloudflareRequestContextSymbol]:
				| RequestContext<CfProperties, Context>
				| undefined;
		}
	)[cloudflareRequestContextSymbol];

	if (!cloudflareRequestContext) {
		throw new Error('Error: failed to retrieve the Cloudflare request context');
	}

	return {
		...cloudflareRequestContext,
	};
}
