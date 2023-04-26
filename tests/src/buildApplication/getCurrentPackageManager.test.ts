import { describe, expect, vi, it, afterEach } from 'vitest';
import { getCurrentPackageExecuter, getCurrentPackageManager } from '../../../src/buildApplication/getCurrentPackageManager';
import { EventEmitter } from 'events';
import type { PackageManager } from '../../../src/utils';

let targetPkgMng: PackageManager = 'yarn (berry)';

describe('getCurrentPackageManager', async () => {
	// yarn berry test environment
	vi.stubEnv('npm_config_user_agent', 'yarn');
	vi.mock('child_process', async () => {
		return {
			spawn: () => {
				const event = new EventEmitter() as EventEmitter & {
					stdout: EventEmitter;
					stderr: EventEmitter;
				};
				event.stdout = new EventEmitter();
				event.stderr = new EventEmitter();
				setTimeout(() => {
					event.stdout.emit(
						'data',
						targetPkgMng === 'yarn (berry)' ? '3.0.0' : '1.0.0'
					);
					event.emit('close', 0);
				}, 100);
				return event;
			},
		};
	});
	vi.mock('fs/promises', async () => {
		return {
			stat: async () => null,
			readFile: async () => `nodeLinker: node-modules`,
		};
	});

	afterEach(async () => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		if (targetPkgMng === 'yarn (berry)') {
			// yarn classic test environment
			vi.stubEnv('npm_config_user_agent', 'yarn');
			targetPkgMng = 'yarn (classic)';
		} else if (targetPkgMng === 'yarn (classic)') {
			// pnpm test environment
			vi.stubEnv('npm_config_user_agent', 'pnpm');
			targetPkgMng = 'pnpm';
		} else if (targetPkgMng === 'pnpm') {
			// npm test environment
			vi.stubEnv('npm_config_user_agent', 'npm');
			targetPkgMng = 'npm';
		}
	});
	it('should detected yarn (berry)', async () => {
		const pkgMng = await getCurrentPackageManager();
		expect(pkgMng).toEqual(targetPkgMng);
	});
	it('should detected yarn (classic)', async () => {
		const pkgMng = await getCurrentPackageManager();
		expect(pkgMng).toEqual(targetPkgMng);
	});
	it('should detected pnpm', async () => {
		const pkgMng = await getCurrentPackageManager();
		expect(pkgMng).toEqual(targetPkgMng);
	});
	it('should detected npm', async () => {
		const pkgMng = await getCurrentPackageManager();
		expect(pkgMng).toEqual(targetPkgMng);
	});
});

describe('getCurrentPackageExecuter', () =>{
	it('TODO', async () => {
		const pkgMng = await getCurrentPackageExecuter();
		expect(pkgMng).toEqual('to implement');
	});
})
