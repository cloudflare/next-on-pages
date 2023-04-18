declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			npm_config_user_agent?: string;
		}
	}
}

export {};
