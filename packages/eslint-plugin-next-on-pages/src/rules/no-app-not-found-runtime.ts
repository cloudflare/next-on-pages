import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
	create: context => {
		const isAppNotFoundRoute = new RegExp(
			`${context.cwd}/app/not-found\\.(tsx|jsx)$`
		).test(context.filename);
		return {
			ExportNamedDeclaration: node => {
				if (!isAppNotFoundRoute) {
					// This rule only applies to app/not-found routes
					return;
				}

				const declaration = node.declaration;
				if (
					declaration?.type === 'VariableDeclaration' &&
					declaration.declarations.length === 1 &&
					declaration.declarations[0]?.id.type === 'Identifier' &&
					declaration.declarations[0].id.name === 'runtime' &&
					declaration.declarations[0].init?.type === 'Literal'
				) {
					context.report({
						message:
							'Only static not-found pages are currently supported, please remove the runtime export in ' +
							context.filename,
						node,
						fix: fixer => fixer.remove(node),
					});
				}
			},
		};
	},
	meta: {
		fixable: 'code',
		docs: {
			url: 'https://github.com/cloudflare/next-on-pages/blob/main/packages/eslint-plugin-next-on-pages/docs/rules/no-app-not-found-runtime.md',
		},
	},
};

export = rule;
