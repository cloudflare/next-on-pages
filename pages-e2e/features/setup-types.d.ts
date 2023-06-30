declare global {
	namespace NodeJS {
		interface ProcessEnv {
			WORKSPACE_DIR: string;
		}
	}
}

export {};
