import type { Rule } from 'eslint';
import type { Node } from 'estree';
import { getProgramNode, traverseAST } from '../utils/ast-traversal';

const rule: Rule.RuleModule = {
	create: context => {
		const insideAppRouter = context.filename.includes('/app/');
		const insideAppApiRoute = context.filename.includes('/app/api');
		const isPage = context.filename.match(/page\.[jt]sx/);

		if (!insideAppRouter || !isPage || insideAppApiRoute) {
			// The rule applies only to pages inside the app router, for all
			// other files not linting should be applied here
			return {};
		}

		// flag indicating whether we've found an `export runtime = 'edge'` in the file or not
		let exportRuntimeEdgeFound = false;

		// flag indicating whether we've found an `export dynamicParams = false` in the file or not
		let dynamicParamsFalseFound = false;

		return {
			ExportNamedDeclaration: node => {
				const declaration = node.declaration;
				if (
					declaration?.type === 'FunctionDeclaration' &&
					declaration.id?.name === 'generateStaticParams'
				) {
					const program = getProgramNode(node);

					if (!program) {
						// for some reason we could not get the AST for the whole program, so let's bail
						return;
					}

					traverseAST(context.sourceCode.visitorKeys, program, (node: Node) => {
						if (node.type === 'ExportNamedDeclaration') {
							if (
								node.declaration?.type === 'VariableDeclaration' &&
								node.declaration.declarations.length === 1 &&
								node.declaration.declarations[0]?.id.type === 'Identifier' &&
								node.declaration.declarations[0].id.name === 'runtime' &&
								node.declaration.declarations[0].init?.type === 'Literal' &&
								node.declaration.declarations[0].init?.value === 'edge'
							) {
								exportRuntimeEdgeFound = true;
							}

							if (
								node.declaration?.type === 'VariableDeclaration' &&
								node.declaration.declarations.length === 1 &&
								node.declaration.declarations[0]?.id.type === 'Identifier' &&
								node.declaration.declarations[0].id.name === 'dynamicParams' &&
								node.declaration.declarations[0].init?.type === 'Literal' &&
								node.declaration.declarations[0].init.value === false
							) {
								dynamicParamsFalseFound = true;
							}
						}
					});

					if (!exportRuntimeEdgeFound && !dynamicParamsFalseFound) {
						context.report({
							message:
								'`generateStaticParams` cannot be used without opting in to the edge runtime or opting out of Dynamic segment handling',
							node: declaration.id,
						});
					}
				}
			},
		};
	},
	meta: {
		fixable: 'code',
		docs: {
			url: 'https://github.com/cloudflare/next-on-pages/blob/main/packages/eslint-plugin-next-on-pages/docs/rules/no-app-nodejs-dynamic-ssg.md',
		},
	},
};

export = rule;
