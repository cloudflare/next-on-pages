/**
 * Generates the javascript content (as a plain string) that deals with the global scope that needs to be
 * added to the built worker.
 *
 * @returns the plain javascript string that should be added at the top of the the _worker.js file
 */
export function generateGlobalJs(): string {
	return `
		const __ENV_ALS_PROMISE__ = import('node:async_hooks').then(({ AsyncLocalStorage }) => {
			globalThis.AsyncLocalStorage = AsyncLocalStorage;

			const envAsyncLocalStorage = new AsyncLocalStorage();

			globalThis.process = {
				env: new Proxy(
					{},
					{
						get: (_, property) => {
							${/* TODO: remove try-catch ASAP (after runtime fix) @dario */ ''}
							try {
								const result = Reflect.get(envAsyncLocalStorage.getStore(), property);
								return result;
							} catch (e) {
								return undefined;
							}
						},
						set: (_, property, value) => Reflect.set(envAsyncLocalStorage.getStore(), property, value),
				}),
			};
			return envAsyncLocalStorage;
		})
		.catch(() => null);
	`;
}
