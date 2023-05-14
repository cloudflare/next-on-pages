import mockFs from 'mock-fs';
import type { DirectoryItems } from 'mock-fs/lib/filesystem';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { generateFunctionsMap } from '../../src/buildApplication/generateFunctionsMap';
import {
	getVercelStaticAssets,
	processVercelOutput,
} from '../../src/buildApplication/processVercelOutput';
import type { VercelPrerenderConfig } from '../../src/buildApplication/fixPrerenderedRoutes';
import { vi } from 'vitest';

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
		data: string;
		headers?: Record<string, string>;
		reqHeaders?: Record<string, string>;
		mockConsole?: { error?: (string | Error)[] };
	};
};

type Asset = { data: string; type: string };
export class MockAssetFetcher {
	private assets: Record<string, Asset>;

	constructor(assets: Record<string, Asset> = {}) {
		this.assets = Object.fromEntries(
			[...Object.entries(assets)].map(([key, value]) => [key, value])
		);
	}

	public fetch = (req: Request) => {
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
			})
		);
	};

	public addAsset = (path: string, data: Asset) => {
		this.assets[path] = data;
	};
}

function createMockEntrypoint(file = 'unknown'): EdgeFunction {
	return {
		default: (request: Request) => {
			const params = [...new URL(request.url).searchParams.entries()];

			return Promise.resolve(
				new Response(JSON.stringify({ file, params }), { status: 200 })
			);
		},
	};
}

function createMockMiddlewareEntrypoint(file = '/'): EdgeFunction {
	return {
		default: (request: Request) => {
			const url = new URL(request.url);
			if (url.pathname !== file) {
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
	item: BuildOutputItem
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

	const fileContents = readFileSync(item.entrypoint, 'utf-8');

	if (item.type === 'middleware') {
		vi.doMock(item.entrypoint, () =>
			createMockMiddlewareEntrypoint(fileContents)
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
	files: DirectoryItems
): Promise<RouterTestData> {
	mockFs({ '.vercel': { output: files } });

	const { functionsMap, prerenderedRoutes } = await generateFunctionsMap(
		join('.vercel', 'output', 'functions'),
		true
	);

	const staticAssets = await getVercelStaticAssets();

	const { vercelConfig, vercelOutput } = processVercelOutput(
		rawVercelConfig,
		staticAssets,
		prerenderedRoutes,
		functionsMap
	);

	const buildOutput = [...vercelOutput.entries()].reduce(
		(prev, [name, item]) => {
			prev[name] = constructBuildOutputRecord(item);
			return prev;
		},
		{} as VercelBuildOutput
	);

	const staticAssetsForFetcher = staticAssets.reduce((acc, path) => {
		const newAcc = { ...acc };

		const item = buildOutput[path];
		const contentType =
			(item?.type === 'override' && item.headers?.['content-type']) ||
			'text/plain;charset=UTF-8';

		const fsPath = join(resolve('.vercel', 'output', 'static'), path);
		const data = readFileSync(fsPath, 'utf-8');

		newAcc[path] = { data, type: contentType };
		return newAcc;
	}, {} as Record<string, Asset>);

	const assetsFetcher = new MockAssetFetcher(
		staticAssetsForFetcher
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

export function createInvalidFuncDir(data: string) {
	return {
		'.vc-config.json': JSON.stringify({
			runtime: 'nodejs',
			entrypoint: 'index.js',
		}),
		'index.js': data,
	};
}

/**
 * Create a fake prerender config file for testing.
 *
 * @param path Path name for the file in the build output.
 * @param ext File extension for the fallback file in the build output.
 * @returns The stringified prerender config file contents.
 */
export function mockPrerenderConfigFile(path: string, ext?: string): string {
	const extension = ext || (path.endsWith('.rsc') ? 'rsc' : 'html');
	const fsPath = `${path}.prerender-fallback.${extension}`;

	const config: VercelPrerenderConfig = {
		type: 'Prerender',
		fallback: {
			type: 'FileFsRef',
			mode: 0,
			fsPath,
		},
		initialHeaders: {
			...(path.endsWith('.rsc') && { 'content-type': 'text/x-component' }),
			...(path.endsWith('.ico') && { 'content-type': 'image/x-icon' }),
			vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
		},
	};
	return JSON.stringify(config);
}

export function createPrerenderedRoute(
	file: string,
	base = ''
): DirectoryItems {
	const fileWithBase = `${base}/${file}`;
	return {
		[`${file}.func`]: createInvalidFuncDir(fileWithBase),
		[`${file}.rsc.func`]: createInvalidFuncDir(`${fileWithBase}.rsc`),
		[`${file}.prerender-config.json`]: mockPrerenderConfigFile(`${file}`),
		[`${file}.prerender-fallback.html`]: `${fileWithBase}.prerender-fallback.html`,
		[`${file}.rsc.prerender-config.json`]: mockPrerenderConfigFile(
			`${file}.rsc`
		),
		[`${file}.rsc.prerender-fallback.rsc`]: `${fileWithBase}.rsc.prerender-fallback.rsc`,
	};
}
