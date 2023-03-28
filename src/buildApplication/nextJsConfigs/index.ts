import { getBasePath } from './getBasePath';

export type NextJsConfigs = {
	basePath?: string;
};

/**
 * generates an object containing the next.config.js options
 * that @cloudflare/next-on-pages supports
 *
 * For the list of supported options see:
 *     https://github.com/cloudflare/next-on-pages/blob/main/docs/supported.md#nextconfigjs-properties
 */
export async function getNextJsConfigs(): Promise<NextJsConfigs> {
	const basePath = await getBasePath();
	return {
		...(basePath ? { basePath } : {}),
	};
}
