import { join } from 'path';
import { build } from 'esbuild';
import { cliLog } from '../cli';
import { validateFile } from '../utils';

/**
 * Detects and compiles instrumentation.ts/js file from the project root.
 * Similar to how custom entrypoints are handled.
 *
 * @param projectDir The project root directory
 * @param nopDistDir The next-on-pages dist directory
 * @returns Path to compiled instrumentation if found, null otherwise
 */
export async function compileInstrumentation(
	projectDir: string,
	nopDistDir: string,
): Promise<string | null> {
	// Check for instrumentation file in common locations
	const possiblePaths = [
		join(projectDir, 'instrumentation.ts'),
		join(projectDir, 'instrumentation.js'),
		join(projectDir, 'src', 'instrumentation.ts'),
		join(projectDir, 'src', 'instrumentation.js'),
		join(projectDir, 'app', 'instrumentation.ts'),
		join(projectDir, 'app', 'instrumentation.js'),
	];

	let instrumentationPath: string | null = null;

	for (const path of possiblePaths) {
		if (await validateFile(path)) {
			instrumentationPath = path;
			break;
		}
	}

	if (!instrumentationPath) {
		return null;
	}

	cliLog(`Found instrumentation file at '${instrumentationPath}'`);

	const outputPath = join(nopDistDir, 'instrumentation.js');

	try {
		// Compile the instrumentation file with esbuild
		await build({
			entryPoints: [instrumentationPath],
			outfile: outputPath,
			bundle: true,
			format: 'esm',
			target: 'es2022',
			platform: 'node',
			minify: true,
			plugins: [
				{
					name: 'server-only-stub',
					setup(build) {
						// Stub out server-only to avoid client component error
						build.onResolve({ filter: /^server-only$/ }, () => ({
							path: 'server-only',
							namespace: 'server-only-stub',
						}));
						build.onLoad(
							{ filter: /.*/, namespace: 'server-only-stub' },
							() => ({
								contents: '// server-only stub for edge runtime',
								loader: 'js',
							}),
						);
					},
				},
			],
			external: ['node:*', 'cloudflare:*'],
			define: {
				'process.env.NEXT_RUNTIME': '"edge"',
			},
			conditions: ['react-server'],
		});

		cliLog('Successfully compiled instrumentation file');
		return outputPath;
	} catch (error) {
		cliLog(`Failed to compile instrumentation file: ${error}`);
		return null;
	}
}
