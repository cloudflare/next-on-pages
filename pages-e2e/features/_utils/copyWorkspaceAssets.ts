/// <reference types="../setup-types.d.ts" />

import { cp, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Copies all the files present in the `./assets` folder into the
 * WORKSPACE_DIR folder (merging potentially already existing directories)
 */
export async function copyWorkspaceAssets(): Promise<void> {
	const { WORKSPACE_DIR } = process.env;

	const assets = await readdir(join(process.cwd(), 'assets'));

	for (const asset of assets) {
		await cp(join(process.cwd(), 'assets', asset), join(WORKSPACE_DIR, asset), {
			recursive: true,
			force: false,
		});
	}
}
