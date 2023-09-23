declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			npm_config_user_agent?: string;
			CF_PAGES?: string;
			CF_NEXT_ON_PAGES_EXECUTION_CONTEXT?: ExecutionContext;
			SHELL?: string;
			[key: string]: string | Fetcher;
		}
	}
}

export {};
