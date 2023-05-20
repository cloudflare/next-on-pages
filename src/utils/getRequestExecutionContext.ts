import { getCloudflareGlobalContext } from './utils/cloudflareGlobalContext';

export function getRequestExecutionContext(): ExecutionContext | undefined {
	const cloudflareGlobalContext = getCloudflareGlobalContext();
	if (!cloudflareGlobalContext) {
		throw new Error(
			'Error: trying to access the request execution context on the client'
		);
	}
	return cloudflareGlobalContext.ctx;
}
