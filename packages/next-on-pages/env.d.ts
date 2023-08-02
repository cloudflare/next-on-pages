declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			npm_config_user_agent?: string;
			CF_PAGES?: string;
			SHELL?: string;
			[key: string]: string | Fetcher;
		}
	}
}

export {};
