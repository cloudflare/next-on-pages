const cloudflareRequestContextSymbol = Symbol.for(
	'__cloudflare-request-context__',
);

/**
 * Next.js uses the Node.js vm module's `runInContext()` function to evaluate the edge functions
 * in a runtime context that tries to simulate as accurately as possible the actual production runtime
 * behavior, see: https://github.com/vercel/next.js/blob/ec0a8da/packages/next/src/server/web/sandbox/context.ts#L450-L452
 *
 * This function monkey-patches the Node.js vm module to override the `runInContext()` function so that
 * miniflare binding proxies can be added to the runtime context's `process.env` before the actual edge
 * functions are evaluated.
 *
 * @param patchData object containing the `bindings`, `ctx` and `cf` to add to the runtime context's `globalThis` and `process.env`
 */
export function monkeyPatchVmModule({
	bindings,
	ctx,
	cf,
}: {
	bindings: Record<string, unknown>;
	ctx: ExecutionContext;
	cf: IncomingRequestCfProperties;
}) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const vmModule = require('vm');

	const originalRunInContext = vmModule.runInContext.bind(vmModule);

	vmModule.runInContext = (
		...args: [
			string,
			Record<string, unknown> & {
				process?: { env?: Record<string, unknown> };
				[cloudflareRequestContextSymbol]?: {
					env: unknown;
					ctx: unknown;
					cf: unknown;
				};
			},
			...[unknown],
		]
	) => {
		const runtimeContext = args[1];

		if (!runtimeContext[cloudflareRequestContextSymbol]) {
			runtimeContext[cloudflareRequestContextSymbol] = {
				env: bindings,
				ctx,
				cf,
			};
			if (runtimeContext.process?.env) {
				for (const [name, binding] of Object.entries(bindings)) {
					runtimeContext.process.env[name] = binding;
				}
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
export function shouldSetupContinue(): boolean {
	// Via debugging we've seen that AsyncLocalStorage is only set in one of the
	// two processes so we're using it as the differentiator between the two
	const AsyncLocalStorage = (
		globalThis as unknown as { AsyncLocalStorage?: unknown }
	)['AsyncLocalStorage'];
	return !!AsyncLocalStorage;
}
