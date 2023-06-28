module.exports = {
	env: {
		es2021: true,
		node: true
	},
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	overrides: [],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		sourceType: "module",
		project: true
	},
	plugins: ["@typescript-eslint", "deprecation"],
	rules: {
		"no-case-declarations": "error",
		"no-console": "error",
		"prefer-const": "error",
		"no-mixed-spaces-and-tabs": "off", // off because it conflicts with prettier
		"eqeqeq": "error",
		"@typescript-eslint/no-explicit-any": "error",
		"@typescript-eslint/no-unused-vars": "error",
		"@typescript-eslint/consistent-type-imports": "error",

		// Promises & async/await
		"no-async-promise-executor": "error",
		"no-promise-executor-return": "error",
		"no-return-await": "error",
		"@typescript-eslint/await-thenable": "error",
		"@typescript-eslint/no-floating-promises": "error",
		"@typescript-eslint/promise-function-async": "error",

		"deprecation/deprecation": "warn",
	},
	ignorePatterns: ["vitest.config.ts"]
};
