import type { AsyncLocalStorage } from 'node:async_hooks';

const cloudflareGlobalContextAlsSymbol = Symbol.for(
	'cloudflare-global-context-als'
);

export function getCloudflareGlobalContextAls():
	| AsyncLocalStorage<CloudflareGlobalContext>
	| undefined {
	const global = globalThis as unknown as {
		[cloudflareGlobalContextAlsSymbol]?: AsyncLocalStorage<CloudflareGlobalContext>;
	};
	return global?.[cloudflareGlobalContextAlsSymbol];
}
