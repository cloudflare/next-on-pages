import { execFileSync, spawn } from 'child_process';
import { readFile } from 'fs/promises';
import YAML from 'js-yaml';
import { cliError, cliWarn } from '../cli';
import { validateFile } from '../utils';

/**
 * Gets the current package manager for the project.
 *
 * Tries to detect the package manager based on the `npm_config_user_agent` environment variable,
 * or the lockfile in the project.
 *
 * Prioritizes PNPM > Yarn > Bun > NPM. If Bun is used on Windows or in the build image, it falls back
 * to the next suitable package manager, with NPM being the default option.
 *
 * @returns Package manager name.
 */
export async function getCurrentPackageManager(): Promise<PackageManager> {
	const userAgent = process.env.npm_config_user_agent;

	const [hasYarnAgent, hasPnpmAgent, hasBunAgent] = ['yarn', 'pnpm', 'bun'].map(
		agent => userAgent?.startsWith(agent),
	);
	const [hasYarnLock, hasPnpmLock, hasBunLock] = await Promise.all(
		['yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'].map(validateFile),
	);

	if (hasPnpmAgent || hasPnpmLock) return 'pnpm';

	if (hasYarnAgent || hasYarnLock) {
		const { baseCmd } = await getPackageManagerInfo('yarn');
		const getYarnV = spawn(baseCmd, ['-v']);
		let yarnV = '';

		getYarnV.stdout.on('data', data => {
			yarnV = `${data}`.trimEnd();
		});
		getYarnV.stderr.on('data', data => cliError(`\n${data}`));

		await waitForProcessToClose(getYarnV);

		if (!yarnV.startsWith('1.')) {
			const yarnrc = await readFile('.yarnrc.yml', 'utf-8');
			const { nodeLinker } = YAML.load(yarnrc) as {
				nodeLinker: string;
			};
			if (nodeLinker !== 'node-modules') {
				cliError(
					`
					Error: Yarn Plug'n'Play not supported

					The vercel cli doesn't currently support Plug'n'Play features from yarn berry.
					Since @cloudflare/next-on-pages uses the vercel cli to build the target application,
					if you want to use the adapter with yarn berry, you need to add "nodeLinker: node-modules"
					to your .yarnrc.yml
				`,
					{ spaced: true },
				);
				process.exit(1);
			}
			return 'yarn (berry)';
		} else {
			return 'yarn (classic)';
		}
	}

	if (hasBunAgent || hasBunLock) {
		if (isWindows()) {
			cliWarn('Bun is not supported on Windows, falling back to npm...');
		} else if (process.env.CF_PAGES && !(await getBinaryVersion('bun'))) {
			cliWarn(
				'Bun is not supported in the Cloudflare Pages build image, falling back to npm...',
			);
		} else {
			return 'bun';
		}
	}

	return 'npm';
}

/**
 * Retrieves information about the package manager, such as the commands that may be used to run it
 * or to execute packages.
 *
 * @param pm Package manager name.
 * @returns Information about the package manager.
 */
export async function getPackageManagerInfo(
	pm?: PackageManager,
): Promise<PackageManagerInfo> {
	pm ??= await getCurrentPackageManager();
	const cmd = isWindows() ? '.cmd' : '';

	switch (pm) {
		case 'bun':
			return {
				pm,
				baseCmd: `bun${cmd}`,
				execArgs: ['x'],
				infoArgs: ['pm', 'ls'],
				getPackageVersionRegex: (name: string) =>
					new RegExp(`^.+ ${name}@(.*)$`, 'im'),
			};
		case 'pnpm':
			return {
				pm,
				baseCmd: `pnpm${cmd}`,
				dlxOrExec: (useDlx: boolean) => [useDlx ? 'dlx' : 'exec'],
				infoArgs: ['list', '--depth=0'],
			};
		case 'yarn (berry)':
		case 'yarn (classic)':
		case 'yarn':
			return {
				pm,
				baseCmd: `yarn${cmd}`,
				dlxOrExec:
					pm === 'yarn (berry)'
						? (useDlx: boolean) => [useDlx ? 'dlx' : 'exec']
						: undefined,
				infoArgs: ['info'],
			};
		case 'npm':
		default:
			return {
				pm,
				baseCmd: `npm${cmd}`,
				execCmd: `npx${cmd}`,
				infoArgs: ['list', '--depth=0'],
			};
	}
}

/**
 * Gets the version of a package installed in the project.
 *
 * @param packageName Name of the package to get the version of.
 * @param packageManager Package manager to use.
 * @returns Version of the package, or `null` if the package is not installed.
 */
export async function getPackageVersion(
	packageName: string,
	packageManager?: PackageManager,
): Promise<string | null> {
	try {
		packageManager ??= await getCurrentPackageManager();
		const { pm, baseCmd, infoArgs, getPackageVersionRegex } =
			await getPackageManagerInfo(packageManager);

		const commandOutput = execFileSync(
			baseCmd,
			[...infoArgs, packageName, '--json'],
			{ stdio: 'pipe' },
		)
			.toString()
			.trim();

		let packageVersion: string | undefined;

		if (getPackageVersionRegex) {
			const match = commandOutput.match(getPackageVersionRegex(packageName));
			packageVersion = match?.[1];
		} else {
			const commandOutputJson = JSON.parse(commandOutput);
			const packageInfo =
				pm === 'pnpm' ? commandOutputJson[0] : commandOutputJson;
			packageVersion = pm.startsWith('yarn')
				? packageInfo?.children?.Version
				: packageInfo?.dependencies?.[packageName]?.version ??
				  packageInfo?.devDependencies?.[packageName]?.version;
		}

		return packageVersion ?? null;
	} catch {
		return null;
	}
}

/**
 * Gets the version of a binary installed on the machine.
 *
 * @param binaryName Name of the binary to get the version of.
 * @returns Version of the binary, or `null` if the binary is not installed.
 */
export async function getBinaryVersion(
	binaryName: string,
): Promise<string | null> {
	const versionFromProcess = process.versions[binaryName];
	if (versionFromProcess) return versionFromProcess;

	try {
		const cmd = isWindows() ? '.cmd' : '';
		return execFileSync(`${binaryName}${cmd}`, ['--version'])
			.toString()
			.trim()
			.replace(/^v/, '');
	} catch {
		return null;
	}
}

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

/**
 * Gets the executable string used for the package manager.
 *
 * @param pm Package manager name.
 * @param packageName Package name.
 * @returns The executable string used for the package manager.
 */
export async function getExecStr(
	pm: PackageManager,
	packageName?: string,
): Promise<string> {
	const {
		baseCmd,
		execCmd,
		dlxOrExec,
		execArgs = [],
	} = await getPackageManagerInfo(pm);

	let dlxArgs: string[] = [];
	if (packageName && dlxOrExec) {
		const vercelPackageIsInstalled = await getPackageVersion(packageName, pm);
		dlxArgs = dlxOrExec(!vercelPackageIsInstalled);
	}

	const args = [...dlxArgs, ...execArgs];

	return `${execCmd ?? baseCmd} ${args.join(' ') ?? ''}`.trim();
}

/**
 * Checks whether the current platform is Windows.
 *
 * @returns Whether the current platform is Windows.
 */
function isWindows(): boolean {
	return process.platform === 'win32';
}

export type PackageManager =
	| 'bun'
	| 'pnpm'
	| 'yarn (berry)'
	| 'yarn (classic)'
	| 'yarn'
	| 'npm';

// export type PackageManagerInfo = {
// 	pm: PackageManager;
// 	baseCmd: string;
// 	execCmd?: string;
// 	execArgs?: string[];
// 	dlxOrExec?: (useDlx: boolean) => string[];
// 	infoArgs: string[];
// 	getPackageVersionRegex?: (name: string) => RegExp;
// };

type PlainPackageManager = Exclude<
	PackageManager,
	'yarn (berry)' | 'yarn (classic)'
>;
type PackageManagerBaseCmd = `${PlainPackageManager}${'' | '.cmd'}`;
export type PackageManagerInfo = {
	pm: PackageManager;
	baseCmd: PackageManagerBaseCmd;
	execCmd?: `npx${'' | '.cmd'}`;
	execArgs?: string[];
	dlxOrExec?: (useDlx: boolean) => ('dlx' | 'exec')[];
	infoArgs: string[];
	getPackageVersionRegex?: (name: string) => RegExp;
};
