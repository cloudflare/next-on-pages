import { getBasePath } from './getBasePath';

export type NextConfigs = {
	basePath?: string;
};

/**
 * generates an object containing the next.config.js options that next-on-pages
 * supports
 *
 * For the list of supported options see: __TODO: add link to support.md section after readme PR is merged__
 */
export async function getNextConfigs(): Promise<NextConfigs> {
	const basePath = await getBasePath();
	return {
		...(basePath ? { basePath } : {}),
	};
}
