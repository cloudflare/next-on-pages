/**
 * Generates the javascript content (as a plain string) that deals with the global scope that needs to be
 * added to the built worker.
 *
 * @returns the plain javascript string that should be added at the top of the the _worker.js file
 */
export function generateGlobalJs(): string {
	return `
		import { AsyncLocalStorage } from 'node:async_hooks';
		globalThis.AsyncLocalStorage = AsyncLocalStorage;

		const __ENV_ALS__ = new AsyncLocalStorage();

		globalThis.process = {
			env: new Proxy(
				{},
				{
					get: (_, property) => Reflect.get(__ENV_ALS__.getStore(), property),
					set: (_, property, value) => Reflect.set(__ENV_ALS__.getStore(), property, value),
			}),
		};
	`
		.replace(/^\s+/, '')
		.replace(/\n\s+/g, ' ');
}
