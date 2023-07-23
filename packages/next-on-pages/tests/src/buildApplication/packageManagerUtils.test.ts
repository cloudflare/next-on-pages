import { describe, test, expect, vi, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import type { PackageManager } from '../../../src/buildApplication/packageManagerUtils';
import {
	getCurrentPackageManager,
	getPackageManagerInfo,
} from '../../../src/buildApplication/packageManagerUtils';
import { mockConsole } from '../../_helpers';

describe('getCurrentPackageManager', async () => {
	test('should detect yarn (berry)', async () => {
		await testWith({ packageManager: 'yarn (berry)' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('yarn (berry)');
		});
	});

	test('should detect yarn (classic)', async () => {
		await testWith({ packageManager: 'yarn (classic)' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('yarn (classic)');
		});
	});

	test('should detect pnpm', async () => {
		await testWith({ packageManager: 'pnpm' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('pnpm');
		});
	});

	test('should detect npm', async () => {
		await testWith({ packageManager: 'npm' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('npm');
		});
	});

	test('should detect bun', async () => {
		await testWith({ packageManager: 'bun' }, async () => {
			const pkgMng = await getCurrentPackageManager();
			expect(pkgMng).toEqual('bun');
		});
	});
});

describe('getPackageManagerInfo', () => {
	test('should detect yarn (berry) on linux', async () => {
		await testWith({ packageManager: 'yarn (berry)' }, async () => {
			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('yarn');
			expect(execCmd).toEqual(undefined);
			expect(execArgs).toEqual(undefined);
			expect(dlxOrExec?.(true)).toEqual(['dlx']);
			expect(dlxOrExec?.(false)).toEqual(['exec']);
		});
	});

	test('should detect yarn (classic) on linux', async () => {
		await testWith({ packageManager: 'yarn (classic)' }, async () => {
			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('yarn');
			expect(execCmd).toEqual(undefined);
			expect(execArgs).toEqual(undefined);
			expect(dlxOrExec).toEqual(undefined);
		});
	});

	test('should detect pnpm on linux', async () => {
		await testWith({ packageManager: 'pnpm' }, async () => {
			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('pnpm');
			expect(execCmd).toEqual(undefined);
			expect(execArgs).toEqual(undefined);
			expect(execArgs).toEqual(undefined);
			expect(dlxOrExec?.(true)).toEqual(['dlx']);
			expect(dlxOrExec?.(false)).toEqual(['exec']);
		});
	});

	test('should detect npm on linux', async () => {
		await testWith({ packageManager: 'npm' }, async () => {
			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('npm');
			expect(execCmd).toEqual('npx');
			expect(execArgs).toEqual(undefined);
			expect(dlxOrExec).toEqual(undefined);
		});
	});

	test('should detect bun on linux', async () => {
		await testWith({ packageManager: 'bun' }, async () => {
			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('bun');
			expect(execCmd).toEqual(undefined);
			expect(execArgs).toEqual(['x']);
			expect(dlxOrExec).toEqual(undefined);
		});
	});

	test('should detect yarn (berry) on windows', async () => {
		await testWith(
			{ packageManager: 'yarn (berry)', os: 'windows' },
			async () => {
				const { baseCmd, execCmd, execArgs, dlxOrExec } =
					await getPackageManagerInfo();

				expect(baseCmd).toEqual('yarn.cmd');
				expect(execCmd).toEqual(undefined);
				expect(execArgs).toEqual(undefined);
				expect(dlxOrExec?.(true)).toEqual(['dlx']);
				expect(dlxOrExec?.(false)).toEqual(['exec']);
			},
		);
	});

	test('should detect yarn (classic) on windows', async () => {
		await testWith(
			{ packageManager: 'yarn (classic)', os: 'windows' },
			async () => {
				const { baseCmd, execCmd, execArgs, dlxOrExec } =
					await getPackageManagerInfo();

				expect(baseCmd).toEqual('yarn.cmd');
				expect(execCmd).toEqual(undefined);
				expect(execArgs).toEqual(undefined);
				expect(dlxOrExec).toEqual(undefined);
			},
		);
	});

	test('should detect pnpm on windows', async () => {
		await testWith({ packageManager: 'pnpm', os: 'windows' }, async () => {
			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('pnpm.cmd');
			expect(execCmd).toEqual(undefined);
			expect(execArgs).toEqual(undefined);
			expect(dlxOrExec?.(true)).toEqual(['dlx']);
			expect(dlxOrExec?.(false)).toEqual(['exec']);
		});
	});

	test('should detect npm on windows', async () => {
		await testWith({ packageManager: 'npm', os: 'windows' }, async () => {
			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('npm.cmd');
			expect(execCmd).toEqual('npx.cmd');
			expect(execArgs).toEqual(undefined);
			expect(dlxOrExec).toEqual(undefined);
		});
	});

	test('should detect fallback instead of bun on windows', async () => {
		await testWith({ packageManager: 'bun', os: 'windows' }, async () => {
			const mockedWarn = mockConsole('warn');

			const { baseCmd, execCmd, execArgs, dlxOrExec } =
				await getPackageManagerInfo();

			expect(baseCmd).toEqual('npm.cmd');
			expect(execCmd).toEqual('npx.cmd');
			expect(execArgs).toEqual(undefined);
			expect(dlxOrExec).toEqual(undefined);

			mockedWarn.expectCalls([
				/Bun is not supported on Windows, falling back to alternative/,
			]);
			mockedWarn.restore();
		});
	});
});

async function testWith(
	{ packageManager, os = 'linux/macos' }: TestWithOpts,
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

type TestWithOpts = {
	packageManager: Exclude<PackageManager, 'yarn'>;
	os?: 'windows' | 'linux/macos';
};

const currentMocks: TestWithOpts = {
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
