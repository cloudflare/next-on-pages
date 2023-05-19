import { getCloudflareGlobalContextAls } from './utils/cloudflareGlobalContext';

export function getRequestExecutionContext(): ExecutionContext | undefined {
	const cloudflareGlobalContextAls = getCloudflareGlobalContextAls();
	if (!cloudflareGlobalContextAls) {
		throw new Error(
			'Error: trying to access the request execution context on the client'
		);
	}
	const store = cloudflareGlobalContextAls.getStore();
	return store?.ctx;
}
