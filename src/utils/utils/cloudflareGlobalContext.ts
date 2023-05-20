import type { AsyncLocalStorage } from 'node:async_hooks';

const cloudflareGlobalContextAlsSymbol = Symbol.for(
	'cloudflare-global-context-als'
);

/**
 * returns the cloudflare global context that we store in the global scope (in an AsyncLocalStorage)
 *
 * @returns the store, or undefined if the AsyncLocalStorage is not present in the global scope (which
 * indicates that this code must be running on the client)
 */
export function getCloudflareGlobalContext():
	| CloudflareGlobalContext
	| undefined {
	const global = globalThis as unknown as {
		[cloudflareGlobalContextAlsSymbol]?: AsyncLocalStorage<CloudflareGlobalContext>;
	};
	const cloudflareGlobalContextAls = global[cloudflareGlobalContextAlsSymbol];
	return cloudflareGlobalContextAls?.getStore();
}
