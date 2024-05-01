declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			npm_config_user_agent?: string;
			CF_PAGES?: string;
			SHELL?: string;
			__NEXT_ON_PAGES__KV_SUSPENSE_CACHE?: KVNamespace;
			__BUILD_METADATA__: NextOnPagesBuildMetadata;
			[key: string]: string | Fetcher;
		}
	}
}

export {};
