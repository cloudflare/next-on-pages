import { describe, expect, vi, it, afterAll } from 'vitest';
import {
	getCurrentPackageExecuter,
	getCurrentPackageManager,
} from '../../../src/buildApplication/getCurrentPackageManager';
import { EventEmitter } from 'events';
import type { PackageManager } from '../../../src/utils';

describe('getCurrentPackageManager', async () => {
	it('should detect yarn (berry)', async () => {
		await testWith('yarn (berry)', async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('yarn (berry)');
		});
	});
	it('should detect yarn (classic)', async () => {
		await testWith('yarn (classic)', async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('yarn (classic)');
		});
	});
	it('should detected pnpm', async () => {
		await testWith('pnpm', async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('pnpm');
		});
	});
	it('should detected pnpm', async () => {
		await testWith('npm', async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('npm');
		});
	});
});

describe('getCurrentPackageExecuter', () => {
	it('should detect yarn (berry)', async () => {
		await testWith('yarn (berry)', async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('yarn dlx');
		});
	});
	it('should detect yarn (classic)', async () => {
		await testWith('yarn (classic)', async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('yarn');
		});
	});
	it('should detected pnpm', async () => {
		await testWith('pnpm', async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('pnpx');
		});
	});
	it('should detected pnpm', async () => {
		await testWith('npm', async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('npx');
		});
	});
});

async function testWith(
	pkgMng: Exclude<PackageManager, 'yarn'>,
	test: () => Promise<void>
): Promise<void> {
	currentPackageManagerMock = pkgMng;
	vi.stubEnv('npm_config_user_agent', pkgMng);
	await test();
	vi.unstubAllEnvs();
}

let currentPackageManagerMock: Exclude<PackageManager, 'yarn'> =
	'yarn (classic)';

vi.mock('fs/promises', async () => {
	return {
		stat: async () => null,
		readFile: async () => `nodeLinker: node-modules`,
	};
});

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
					currentPackageManagerMock === 'yarn (berry)' ? '3.0.0' : '1.0.0'
				);
				event.emit('close', 0);
			}, 100);
			return event;
		},
	};
});

afterAll(async () => {
	vi.clearAllMocks();
});
