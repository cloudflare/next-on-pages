import { cliWarn } from '../cli';

import { readFile } from 'fs/promises';
import { join } from 'path';

export async function getBuildId(): Promise<string> {
	let buildId = 'undefined';
	try {
		buildId = await readFile(join('.next', 'BUILD_ID'), 'utf8');
	} catch (e) {
		cliWarn(
			`
			WARNING:
				The BUILD_ID file was not found in .next folder.
				Next.js uses a constant id generated at build time to identify which version of your application is being served.
		`,
			{ spaced: true },
		);
	}

	return buildId;
}
