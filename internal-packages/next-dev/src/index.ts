import { Request, Response, Headers } from 'miniflare';
import { getBindingsProxy, type GetBindingsProxyOptions } from 'wrangler';

/**
 * Sets up the bindings that need to be available during development time (using
 * Next.js' standard dev server)
 *
 * Note: the function is an async one but it doesn't need to be awaited
 *
 * @param options options indicating what bindings need to be available and where/if to persist them
 */
export async function setupDevBindings(
	options: GetBindingsProxyOptions,
): Promise<void> {
	const continueSetup = shouldSetupContinue();
	if (!continueSetup) return;

	const { bindings } = await getBindingsProxy(options);

	monkeyPatchVmModule(bindings);
}

/**
 * Next.js uses the Node.js vm module's `runInContext()` function to evaluate the edge functions
 * in a runtime context that tries to simulate as accurately as possible the actual production runtime
 * behavior, see: https://github.com/vercel/next.js/blob/ec0a8da/packages/next/src/server/web/sandbox/context.ts#L450-L452
 *
 * This function monkey-patches the Node.js vm module to override the `runInContext()` function so that
 * miniflare binding proxies can be added to the runtime context's `process.env` before the actual edge
 * functions are evaluated.
 *
 * @param bindings array containing the miniflare binding proxies to add to the runtime context's `process.env`
 */
function monkeyPatchVmModule(bindings: Record<string, unknown>) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const vmModule = require('vm');

	const originalRunInContext = vmModule.runInContext.bind(vmModule);

	const bindingsProxyHasBeenSetSymbol = Symbol('BINDINGS_PROXY_HAS_BEEN_SET');

	vmModule.runInContext = (
		...args: [
			string,
			Record<string, unknown> & {
				process?: { env?: Record<string | symbol, unknown> };
			},
			...[unknown],
		]
	) => {
		const runtimeContext = args[1];

		if (
			runtimeContext.process?.env &&
			!runtimeContext.process.env[bindingsProxyHasBeenSetSymbol]
		) {
			for (const [name, binding] of Object.entries(bindings)) {
				runtimeContext.process.env[name] = binding;
			}

			runtimeContext['Request'] = new Proxy(Request, {
				construct(target, args, newTarget) {
					if (
						args.length >= 2 &&
						typeof args[1] === 'object' &&
						args[1].duplex === undefined
					) {
						args[1].duplex = 'half';
					}
					return Reflect.construct(target, args, newTarget);
				},
			});
			runtimeContext['Response'] = Response;
			runtimeContext['Headers'] = Headers;

			runtimeContext.process.env[bindingsProxyHasBeenSetSymbol] = true;
		}

		return originalRunInContext(...args);
	};
}

/**
 * Next dev server imports the config file twice (in two different processes, making it hard to track),
 * this causes the setup to run twice as well, to keep things clean and not allocate extra resources
 * (i.e. instantiate two miniflare instances) it would be best to run this function only once, this
 * function is used to try to run the setup only once, it returns a flag which indicates if the setup
 * should run in the current process or not.
 *
 * @returns boolean indicating if the setup should continue
 */
function shouldSetupContinue(): boolean {
	// Via debugging we've seen that AsyncLocalStorage is only set in one of the
	// two processes so we're using it as the differentiator between the two
	const AsyncLocalStorage = (
		globalThis as unknown as { AsyncLocalStorage?: unknown }
	)['AsyncLocalStorage'];
	return !!AsyncLocalStorage;
}
