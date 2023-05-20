import { getCloudflareGlobalContext } from './utils/cloudflareGlobalContext';

/**
 * returns the request's execution context (usually referred as ctx).
 *
 * Note: this function throws when run on the client, where there is execution context
 *
 * @returns the request's execution context
 */
export function getRequestExecutionContext(): ExecutionContext {
	const cloudflareGlobalContext = getCloudflareGlobalContext();
	if (!cloudflareGlobalContext) {
		throw new Error(
			'Error: trying to access the request execution context on the client'
		);
	}
	return cloudflareGlobalContext.ctx;
}
