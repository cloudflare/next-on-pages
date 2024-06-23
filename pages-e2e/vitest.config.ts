/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
	test: {
		retry: 3,
	},
});
