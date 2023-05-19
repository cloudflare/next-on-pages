import type { AsyncLocalStorage } from 'node:async_hooks';

const cloudflareGlobalContextSymbol = Symbol.for('cloudflare-global-context');

export function getCloudflareGlobalContextAls():
	| AsyncLocalStorage<CloudflareGlobalContext>
	| undefined {
	const global = globalThis as unknown as {
		[cloudflareGlobalContextSymbol]?: AsyncLocalStorage<CloudflareGlobalContext>;
	};
	return global?.[cloudflareGlobalContextSymbol];
}
