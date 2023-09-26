import type { spawn } from 'node:child_process';

/**
 * Waits for a spawned process to close.
 *
 * @param spawnedProcess Spawned process to wait for.
 * @returns Promise that resolves when the process closes with code 0, or rejects when the process
 * closes with a non-zero code.
 */
export async function waitForProcessToClose(
	spawnedProcess: ReturnType<typeof spawn>,
): Promise<void> {
	return new Promise((resolve, reject) => {
		spawnedProcess.on('close', code => {
			if (code === 0) {
				resolve();
			} else {
				reject();
			}
		});
	});
}
