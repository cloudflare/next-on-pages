import type { AsyncLocalStorage } from 'node:async_hooks';
import type {
	IncomingRequestCfProperties,
	ExecutionContext,
} from '@cloudflare/workers-types';

export const cloudflareGlobalContextSymbol = Symbol.for(
	'cloudflare-global-context'
);

export type CloudflareGlobalContext = {
	cf?: IncomingRequestCfProperties;
	ctx: ExecutionContext;
};

export function getCloudflareGlobalContextAls():
	| AsyncLocalStorage<CloudflareGlobalContext>
	| undefined {
	const global = globalThis as unknown as {
		[cloudflareGlobalContextSymbol]?: AsyncLocalStorage<CloudflareGlobalContext>;
	};
	return global?.[cloudflareGlobalContextSymbol];
}
