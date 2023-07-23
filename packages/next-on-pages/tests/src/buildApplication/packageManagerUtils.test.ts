import { describe, expect, vi, it, afterAll } from 'vitest';
import type { PackageManager } from '../../../src/buildApplication/packageManagerUtils';
import {
	getCurrentPackageExecuter,
	getCurrentPackageManager,
} from '../../../src/buildApplication/packageManagerUtils';
import { EventEmitter } from 'events';

describe('getCurrentPackageManager', async () => {
	it('should detect yarn (berry)', async () => {
		await testWith({ packageManager: 'yarn (berry)' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('yarn (berry)');
		});
	});
	it('should detect yarn (classic)', async () => {
		await testWith({ packageManager: 'yarn (classic)' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('yarn (classic)');
		});
	});
	it('should detected pnpm', async () => {
		await testWith({ packageManager: 'pnpm' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('pnpm');
		});
	});
	it('should detected npm', async () => {
		await testWith({ packageManager: 'npm' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('npm');
		});
	});
});

describe('getCurrentPackageExecuter', () => {
	it('should detect yarn (berry)', async () => {
		await testWith({ packageManager: 'yarn (berry)' }, async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('yarn dlx');
		});
	});
	it('should detect yarn (classic)', async () => {
		await testWith({ packageManager: 'yarn (classic)' }, async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('yarn');
		});
	});
	it('should detected pnpm', async () => {
		await testWith({ packageManager: 'pnpm' }, async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('pnpx');
		});
	});
	it('should detected npm', async () => {
		await testWith({ packageManager: 'npm' }, async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('npx');
		});
	});

	it('should detect yarn (berry) on windows', async () => {
		await testWith(
			{ packageManager: 'yarn (berry)', os: 'windows' },
			async () => {
				const pkgMng = await getCurrentPackageExecuter();
				expect(pkgMng).toEqual('yarn.cmd dlx');
			},
		);
	});
	it('should detect yarn (classic) on windows', async () => {
		await testWith(
			{ packageManager: 'yarn (classic)', os: 'windows' },
			async () => {
				const pkgMng = await getCurrentPackageExecuter();
				expect(pkgMng).toEqual('yarn.cmd');
			},
		);
	});
	it('should detected pnpm on windows', async () => {
		await testWith({ packageManager: 'pnpm', os: 'windows' }, async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('pnpx.cmd');
		});
	});
	it('should detected npm on windows', async () => {
		await testWith({ packageManager: 'npm', os: 'windows' }, async () => {
			const pkgMng = await getCurrentPackageExecuter();
			expect(pkgMng).toEqual('npx.cmd');
		});
	});
});

async function testWith(
	{
		packageManager,
		os = 'linux/macos',
	}: {
		packageManager: Exclude<PackageManager, 'yarn'>;
		os?: 'windows' | 'linux/macos';
	},
	test: () => Promise<void>,
): Promise<void> {
	currentMocks.packageManager = packageManager;
	currentMocks.os = os;
	vi.stubEnv('npm_config_user_agent', packageManager);
	vi.spyOn(process, 'platform', 'get').mockReturnValue(
		currentMocks.os === 'windows' ? 'win32' : 'linux',
	);
	await test();
	vi.unstubAllEnvs();
}

const currentMocks: {
	packageManager: Exclude<PackageManager, 'yarn'>;
	os: 'windows' | 'linux/macos';
} = {
	packageManager: 'npm',
	os: 'windows',
};

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
					currentMocks.packageManager === 'yarn (berry)' ? '3.0.0' : '1.0.0',
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
