import { getBindingsProxy, type GetBindingsProxyOptions } from 'wrangler';
import { monkeyPatchVmModule, shouldSetupContinue } from './shared';

export * from './deprecated';

/**
 * Sets up the bindings that need to be available during development time (using
 * Next.js' standard dev server)
 *
 * Note: the function is an async one but it doesn't need to be awaited
 *
 * @param options options indicating what bindings need to be available and where/if to persist them
 */
export async function setupDevPlatform(
	options: GetBindingsProxyOptions,
): Promise<void> {
	const continueSetup = shouldSetupContinue();
	if (!continueSetup) return;

	const { bindings } = await getBindingsProxy(options);

	monkeyPatchVmModule(bindings);
}
