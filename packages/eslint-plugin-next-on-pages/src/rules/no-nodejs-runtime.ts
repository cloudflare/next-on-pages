import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
	create: context => {
		return {
			ExportNamedDeclaration: node => {
				const declaration = node.declaration;
				if (
					declaration?.type === 'VariableDeclaration' &&
					declaration.declarations.length === 1 &&
					declaration.declarations[0]?.id.type === 'Identifier' &&
					declaration.declarations[0].id.name === 'runtime' &&
					declaration.declarations[0].init?.type === 'Literal' &&
					declaration.declarations[0].init?.value === 'nodejs'
				) {
					context.report({
						message:
							"The 'nodejs' runtime is not supported. Use 'edge' instead.",
						node: declaration.declarations[0].init,
						fix: fixer =>
							declaration.declarations[0]?.init
								? fixer.replaceText(declaration.declarations[0].init, "'edge'")
								: null,
					});
				}
			},
		};
	},
	meta: {
		fixable: 'code',
		docs: {
			url: 'https://github.com/cloudflare/next-on-pages/blob/main/packages/eslint-plugin-next-on-pages/docs/rules/no-nodejs-runtime.md',
		},
	},
};

export = rule;
