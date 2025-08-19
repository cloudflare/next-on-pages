import mockFs from 'mock-fs';
import type { DirectoryItems } from 'mock-fs/lib/filesystem';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
	getVercelStaticAssets,
	processOutputDir,
	processVercelOutput,
} from '../../src/buildApplication/processVercelOutput';
import { expect, vi } from 'vitest';
import {
	processVercelFunctions,
	type ProcessVercelFunctionsOpts,
} from '../../src/buildApplication/processVercelFunctions';
import type { FunctionInfo } from '../../src/buildApplication/processVercelFunctions/configs';
import { collectFunctionConfigsRecursively } from '../../src/buildApplication/processVercelFunctions/configs';

export type TestSet = {
	name: string;
	files: { functions: DirectoryItems; static?: DirectoryItems };
	config: VercelConfig;
	testCases: TestCase[];
};
export type TestCase = {
	name: string;
	paths: string[];
	host?: string;
	headers?: Record<string, string>;
	method?: string;
	expected: {
		status: number;
		data: string | RegExp;
		headers?: Record<string, string>;
		ignoreHeaders?: boolean;
		reqHeaders?: Record<string, string>;
		mockConsole?: { log?: string[]; error?: (string | Error)[] };
	};
};

type Asset = { data: string; type: string };
export class MockAssetFetcher {
	private assets: Record<string, Asset>;

	constructor(assets: Record<string, Asset> = {}) {
		this.assets = Object.fromEntries(
			[...Object.entries(assets)].map(([key, value]) => [key, value]),
		);
	}

	public fetch = async (req: Request) => {
		const { pathname } = new URL(req.url);
		const noExt = pathname.replace(/\.html$/, '');
		const withExt = `${noExt.replace(/^\/$/, '/index')}.html`;

		const asset = this.assets[noExt] || this.assets[withExt];
		if (!asset) {
			return Promise.resolve(new Response('Asset not found', { status: 404 }));
		}

		return Promise.resolve(
			new Response(asset.data, {
				status: 200,
				headers: { 'content-type': asset.type },
			}),
		);
	};

	public addAsset = (path: string, data: Asset) => {
		this.assets[path] = data;
	};
}

function createMockEntrypoint(file = 'unknown'): EdgeFunction {
	return {
		default: async (request: Request) => {
			const params = [...new URL(request.url).searchParams.entries()];

			return Promise.resolve(
				new Response(JSON.stringify({ file, params }), { status: 200 }),
			);
		},
	};
}

function createMockMiddlewareEntrypoint(file = '/'): EdgeFunction {
	return {
		default: async (request: Request) => {
			const url = new URL(request.url);
			if (!url.pathname.startsWith(file)) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}

			if (url.searchParams.has('throw')) {
				return Promise.reject(new Error('Middleware error'));
			}

			if (url.searchParams.has('rewrite')) {
				return new Response(null, {
					status: 200,
					headers: new Headers({
						'x-middleware-rewrite': new URL('/some-page', url).toString(),
					}),
				});
			}

			if (url.searchParams.has('redirect')) {
				return new Response(null, {
					status: 307,
					headers: new Headers({
						location: new URL('/somewhere-else', url).toString(),
					}),
				});
			}

			if (url.searchParams.has('next')) {
				return new Response(null, {
					status: 200,
					headers: new Headers({ 'x-middleware-next': '1' }),
				});
			}

			if (url.searchParams.has('setHeader')) {
				return new Response(null, {
					status: 200,
					headers: new Headers({
						'set-cookie': 'x-hello-from-middleware2=hello; Path=/',
						'x-hello-from-middleware2': 'hello',
						'x-middleware-next': '1',
						'x-middleware-override-headers': 'overriden-header,x-new-header',
						'x-middleware-request-overriden-header': 'overriden in middleware',
						'x-middleware-request-x-new-header': 'added in middleware',
					}),
				});
			}

			if (url.searchParams.has('returns')) {
				return new Response('<html>Hello from middleware</html>', {
					status: 401,
					headers: new Headers({
						'content-type': 'text/html',
					}),
				});
			}

			if (url.searchParams.has('returns200')) {
				return new Response('Hello, World!', {
					status: 200,
					headers: new Headers({
						'content-type': 'text/html',
					}),
				});
			}

			if (url.searchParams.has('log')) {
				// eslint-disable-next-line no-console
				console.log('Hello from middleware');
			}

			return new Response(null, {
				status: 200,
				headers: new Headers({
					'set-cookie': 'x-hello-from-middleware2=hello; Path=/',
					'x-hello-from-middleware2': 'hello',
					'x-middleware-next': '1',
				}),
			});
		},
	};
}

function constructBuildOutputRecord(
	item: BuildOutputItem,
	workerJsDir: string,
): VercelBuildOutputItem {
	if (item.type === 'static') {
		return { type: item.type };
	}

	if (item.type === 'override') {
		return {
			type: item.type,
			path: item.path,
			headers: item.headers,
		};
	}

	const fileContents = readFileSync(
		join(workerJsDir, item.entrypoint),
		'utf-8',
	);

	if (item.type === 'middleware') {
		vi.doMock(item.entrypoint, () =>
			createMockMiddlewareEntrypoint(fileContents),
		);
	} else if (item.type === 'function') {
		vi.doMock(item.entrypoint, () => createMockEntrypoint(fileContents));
	}

	return item;
}

type RouterTestData = {
	vercelConfig: ProcessedVercelConfig;
	buildOutput: VercelBuildOutput;
	assetsFetcher: Fetcher;
	restoreMocks: () => void;
};

export async function createRouterTestData(
	rawVercelConfig: VercelConfig,
	files: DirectoryItems,
	outputDir = join('.vercel', 'output', 'static'),
): Promise<RouterTestData> {
	mockFs({ '.vercel': { output: files } });

	const workerJsDir = join(outputDir, '_worker.js');

	const { collectedFunctions } = await processVercelFunctions({
		functionsDir: join('.vercel', 'output', 'functions'),
		outputDir,
		workerJsDir: workerJsDir,
		nopDistDir: join(workerJsDir, '__next-on-pages-dist__'),
		disableChunksDedup: true,
		vercelConfig: { version: 3 },
		ignoreInvalidFunctions: false,
	});

	const staticAssets = await getVercelStaticAssets();

	const { vercelConfig, vercelOutput } = processVercelOutput(
		rawVercelConfig,
		staticAssets,
		collectedFunctions.prerenderedFunctions,
		collectedFunctions.edgeFunctions,
	);

	const buildOutput = [...vercelOutput.entries()].reduce(
		(prev, [name, item]) => {
			prev[name] = constructBuildOutputRecord(item, workerJsDir);
			return prev;
		},
		{} as VercelBuildOutput,
	);

	const staticAssetsForFetcher = staticAssets.reduce(
		(acc, path) => {
			const newAcc = { ...acc };

			const item = buildOutput[path];
			const contentType =
				(item?.type === 'override' && item.headers?.['content-type']) ||
				'text/plain;charset=UTF-8';

			const fsPath = join(resolve('.vercel', 'output', 'static'), path);
			const data = readFileSync(fsPath, 'utf-8');

			newAcc[path] = { data, type: contentType };
			return newAcc;
		},
		{} as Record<string, Asset>,
	);

	const assetsFetcher = new MockAssetFetcher(
		staticAssetsForFetcher,
	) as unknown as Fetcher;

	mockFs.restore();
	return {
		vercelConfig,
		buildOutput,
		assetsFetcher,
		restoreMocks: () => {
			mockFs.restore();
			vi.clearAllMocks();
		},
	};
}

export function createValidFuncDir(data: string) {
	return {
		'.vc-config.json': JSON.stringify({
			runtime: 'edge',
			entrypoint: 'index.js',
		}),
		'index.js': data,
	};
}

export function createInvalidFuncDir(
	data: string,
	{ prerender }: { prerender?: boolean } = {},
) {
	return {
		'.vc-config.json': JSON.stringify({
			runtime: 'nodejs',
			...(prerender && { operationType: 'ISR' }),
			entrypoint: 'index.js',
		}),
		'index.js': data,
	};
}

/**
 * Create a fake prerender config file for testing.
 *
 * @param path Path name for the file in the build output.
 * @param opts File extension for the fallback in the build output and prerender config options.
 * @returns The stringified prerender config file contents.
 */
export function mockPrerenderConfigFile(
	path: string,
	opts: { ext?: string; sourcePath?: string } = {},
): string {
	const extension = opts.ext || (path.endsWith('.rsc') ? 'rsc' : 'html');
	const fsPath = `${path}.prerender-fallback.${extension}`;

	const config: VercelPrerenderConfig = {
		type: 'Prerender',
		fallback: {
			type: 'FileFsRef',
			mode: 0,
			fsPath,
		},
		sourcePath: opts.sourcePath,
		initialHeaders: {
			...((path.endsWith('.rsc') || path.endsWith('.json')) && {
				'content-type': 'text/x-component',
			}),
			...(path.endsWith('.txt') && { 'content-type': 'text/plain' }),
			...(path.endsWith('.xml') && { 'content-type': 'application/xml' }),
			...(path.endsWith('.ico') && { 'content-type': 'image/x-icon' }),
			vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
		},
	};
	return JSON.stringify(config);
}

export function createPrerenderedRoute(
	file: string,
	base = '',
): DirectoryItems {
	const fileWithBase = `${base}/${file}`;
	return {
		[`${file}.func`]: createInvalidFuncDir(fileWithBase, { prerender: true }),
		[`${file}.rsc.func`]: createInvalidFuncDir(`${fileWithBase}.rsc`, {
			prerender: true,
		}),
		[`${file}.prerender-config.json`]: mockPrerenderConfigFile(`${file}`),
		[`${file}.prerender-fallback.html`]: `${fileWithBase}.prerender-fallback.html`,
		[`${file}.rsc.prerender-config.json`]: mockPrerenderConfigFile(
			`${file}.rsc`,
		),
		[`${file}.rsc.prerender-fallback.rsc`]: `${fileWithBase}.rsc.prerender-fallback.rsc`,
	};
}

type ConsoleMethods = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[Method in keyof Console]: Console[Method] extends (...args: any[]) => any
		? Method
		: never;
}[keyof Console];
export function mockConsole(method: ConsoleMethods) {
	const mockedMethod = vi.spyOn(console, method).mockImplementation(() => null);

	const restore = () => mockedMethod.mockRestore();

	const expectCalls = (calls: (RegExp | unknown)[]) => {
		expect(mockedMethod).toHaveBeenCalledTimes(calls.length);
		calls.forEach(msg =>
			expect(mockedMethod).toHaveBeenCalledWith(
				msg instanceof RegExp ? expect.stringMatching(msg) : msg,
			),
		);
	};

	return { restore, expectCalls };
}

/**
 * Collects the functions from the file system and generates functions maps.
 *
 * @param functions Functions directory items.
 * @param staticAssets Static assets directory items.
 * @param opts Options for processing the functions.
 * @param otherDirs Other root-level directories to create in the mock file system
 * @returns Results from collecting the functions.
 */
export async function collectFunctionsFrom(
	{
		functions = {},
		static: staticAssets = {},
		otherDirs = {},
	}: {
		functions?: DirectoryItems;
		static?: DirectoryItems;
		otherDirs?: DirectoryItems;
	},
	{
		functionsDir = resolve('.vercel', 'output', 'functions'),
		outputDir = resolve('.vercel', 'output', 'static'),
	}: Partial<ProcessVercelFunctionsOpts> = {},
) {
	mockFs({
		'.vercel': { output: { functions, static: staticAssets } },
		...otherDirs,
	});

	await processOutputDir(outputDir, await getVercelStaticAssets());
	const collectedFunctions = await collectFunctionConfigsRecursively(
		functionsDir,
	);

	return { collectedFunctions, restoreFsMock: () => mockFs.restore() };
}

/**
 * Gets the route info for a function.
 *
 * @param functions Map of functions to get the route info from.
 * @param path Path to the function.
 * @returns The route info for the function.
 */
export function getRouteInfo(
	functions: Map<string, FunctionInfo>,
	path: string,
) {
	return functions.get(resolve('.vercel', 'output', 'functions', path))?.route;
}

/**
 * Gets the entrypoint for a function.
 *
 * @param functions Map of functions to get the entrypoint from.
 * @param path Path to the function.
 * @returns The entrypoint for the function.
 */
export function getRouteEntrypoint(
	functions: Map<string, FunctionInfo>,
	path: string,
) {
	return functions.get(resolve('.vercel', 'output', 'functions', path))?.config
		?.entrypoint;
}

export const edgeFuncDir = {
	'.vc-config.json': JSON.stringify({
		runtime: 'edge',
		entrypoint: 'index.js',
	}),
	'index.js': '',
};

export const nodejsFuncDir = {
	'.vc-config.json': JSON.stringify({
		runtime: 'nodejs',
		entrypoint: 'index.js',
	}),
	'index.js': '',
};

export const prerenderFuncDir = {
	'.vc-config.json': JSON.stringify({
		operationType: 'ISR',
		runtime: 'nodejs',
		entrypoint: 'index.js',
	}),
	'index.js': '',
};
