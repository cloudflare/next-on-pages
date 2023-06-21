module.exports = {
	"env": {
		"es2021": true,
		"node": true
	},
	"extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	"overrides": [],
	"parser": "@typescript-eslint/parser",
	"parserOptions": {
		"sourceType": "module",
		"project": true
	},
	"plugins": ["@typescript-eslint"],
	"rules": {
		"no-case-declarations": "error",
		"no-console": "error",
		"prefer-const": "error",
		"no-mixed-spaces-and-tabs": "off", // off because it conflicts with prettier
		"eqeqeq": "error",

		"@typescript-eslint/no-explicit-any": "error",
		"@typescript-eslint/no-unused-vars": "error",
		"@typescript-eslint/consistent-type-imports": "error"
	},
	"ignorePatterns": ["vitest.config.ts"]
};
