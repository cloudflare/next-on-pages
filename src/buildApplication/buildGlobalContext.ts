/**
 * Generates the javascript content (as a plain string) that deals with the global scope that needs to be
 * added to the built worker.
 *
 * @param nodeEnv the type of node environment (either 'development', 'production' or 'test', as per the Next.js docs: https://nextjs.org/docs/basic-features/environment-variables)
 * @returns the plain javascript string that should be added at the top of the the _worker.js file
 */
export function generateGlobalJs(
	nodeEnv: 'production' | 'development' | 'test'
): string {
	return `globalThis.process = { env: { NODE_ENV: '${nodeEnv}' } };`;
}
