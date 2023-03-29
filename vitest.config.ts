import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'edge-runtime',
		setupFiles: ['tests/setup.ts'],
	},
});
