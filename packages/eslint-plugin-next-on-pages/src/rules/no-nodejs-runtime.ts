import type { Rule } from 'eslint';
import assert, { AssertionError } from 'node:assert';

const rule: Rule.RuleModule = {
	create: context => {
		return {
			ExportNamedDeclaration: node => {
				try {
					const declaration = node.declaration;
					assert(declaration?.type === 'VariableDeclaration');
					assert(declaration.declarations.length === 1);
					const actualDeclaration = declaration.declarations[0];
					assert(actualDeclaration?.id.type === 'Identifier');
					assert(actualDeclaration.id.name === 'runtime');
					assert(actualDeclaration.init?.type === 'Literal');
					assert(actualDeclaration.init?.value === 'nodejs');

					context.report({
						message:
							"The 'nodejs' runtime is not supported. Use 'edge' instead.",
						node: actualDeclaration.init,
						fix: fixer =>
							actualDeclaration.init
								? fixer.replaceText(actualDeclaration.init, "'edge'")
								: null,
					});
				} catch (e) {
					if (!(e instanceof AssertionError)) {
						throw e;
					}
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
