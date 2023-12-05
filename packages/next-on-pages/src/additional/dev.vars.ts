import { validateFile } from '../utils';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { cliLog, cliWarn } from '../cli';

/**
 * Builds a .dev.vars file based on the user .env.local file
 *
 * Next.js supports the .env.local file for local env variables
 * (see: https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables#loading-environment-variables)
 * but such file is not read by `wrangler pages dev`, which instead requires a .dev.vars file
 * (see: https://developers.cloudflare.com/pages/platform/functions/bindings/#interact-with-your-secrets-locally)
 * so this utility is implemented to help keeping the two in sync
 */
export async function buildDevVarsFile() {
	const envLocal = resolve('.env.local');

	const fileExists = await validateFile(envLocal);

	if (!fileExists) {
		cliWarn(
			`-u, --build-dev-vars option provided but no .env.local file found`,
		);
	} else {
		const envLocalContent = await readFile(envLocal, 'utf-8');
		await writeFile(resolve('.dev.vars'), envLocalContent);
		cliLog('Built .dev.vars file');
	}
}
