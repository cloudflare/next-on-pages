declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			npm_config_user_agent?: string;
			[key: string]: string | Fetcher;
		}
	}

	type CloudflareGlobalContext = {
		cf?: IncomingRequestCfProperties;
		ctx: ExecutionContext;
	};
}

export {};
