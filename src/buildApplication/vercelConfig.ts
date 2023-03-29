import { readJsonFile } from '../utils';

const supportedConfigVersion = 3;

/**
 * In src we don't make use of this object (just pass it along to the worker)
 * for the full types of this object see: `templates/_worker.js/types.d.ts`
 */
export type VercelConfig = {
	version: typeof supportedConfigVersion;
	routes?: unknown;
	images?: unknown;
	wildcard?: unknown;
	overrides?: unknown;
	cache?: string[];
	crons?: unknown;
};

/**
 * gets the vercel config from the `.vercel/output/config.json` file, throws
 * if the file can't be parsed or if it contains a vercel config of the wrong version
 *
 * TODO: add validation to make sure that the parsed config is in the format
 *       we expect it to be
 *
 * @returns the object parsed from the config file
 */
export async function getVercelConfig(): Promise<VercelConfig> {
	const config = await readJsonFile<VercelConfig>('.vercel/output/config.json');
	if (!config) {
		throw new Error("Could not read the '.vercel/output/config.json' file.");
	}

	if (config.version !== 3) {
		throw new Error(
			`Unknown '.vercel/output/config.json' version. Expected ${supportedConfigVersion} but found ${config.version}.`
		);
	}

	return config;
}
