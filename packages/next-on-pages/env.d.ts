declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			npm_config_user_agent?: string;
			[key: string]: string | Fetcher;
		}
	}
}

export {};
