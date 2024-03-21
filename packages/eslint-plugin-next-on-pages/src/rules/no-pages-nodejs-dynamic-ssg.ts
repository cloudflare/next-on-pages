import type { Rule } from 'eslint';
import type {
	ExportNamedDeclaration,
	Node,
	ObjectExpression,
	Property,
} from 'estree';
import { getProgramNode, traverseAST } from '../utils/ast-traversal';

const rule: Rule.RuleModule = {
	create: context => {
		const insidePagesRouter = context.filename.includes('/pages/');
		const insidePagesApiRoute = context.filename.includes('/pages/api');
		const isJTsx = context.filename.match(/\.[jt]sx$/);

		if (!insidePagesRouter || !isJTsx || insidePagesApiRoute) {
			// The rule applies only to pages inside the pages router, for all
			// other files not linting should be applied here
			return {};
		}

		// flag indicating whether we've found an `export runtime = 'experimental-edge'` and alternatives in the file or not
		let exportRuntimeEdgeFound = false;

		// Note: we don't have to care about the case in which `fallback` is not specified since the value is mandatory and
		//       the Next.js compiler fails the build the value is not specified
		//       (source: https://github.com/vercel/next.js/blob/1c998d86d/packages/next/src/build/utils.ts#L1004-L1014)
		let nonFalseFallbackValue: Node | null = null;

		return {
			ExportNamedDeclaration: node => {
				const declaration = node.declaration;
				if (
					declaration?.type === 'FunctionDeclaration' &&
					declaration.id?.name === 'getStaticPaths'
				) {
					traverseAST(
						context.sourceCode.visitorKeys,
						declaration.body,
						(node: Node) => {
							if (node.type === 'ReturnStatement') {
								if (node.argument?.type === 'ObjectExpression') {
									nonFalseFallbackValue = getNonFalseFallbackPropIfPresent(
										node.argument,
									);
									return;
								}

								if (node.argument?.type === 'Identifier') {
									const identifierName = node.argument.name;
									const body = declaration.body;
									traverseAST(
										context.sourceCode.visitorKeys,
										body,
										(node: Node) => {
											if (node.type === 'VariableDeclaration') {
												const targetDeclaration = node.declarations.find(
													declaration =>
														declaration.id.type === 'Identifier' &&
														declaration.id.name === identifierName &&
														declaration.init?.type === 'ObjectExpression',
												);
												if (targetDeclaration) {
													nonFalseFallbackValue =
														getNonFalseFallbackPropIfPresent(
															targetDeclaration.init as ObjectExpression,
														);
												}
											}
										},
									);
									return;
								}
							}
						},
					);

					const program = getProgramNode(node);

					if (!program) {
						// for some reason we could not get the AST for the whole program, so let's bail
						return;
					}

					traverseAST(context.sourceCode.visitorKeys, program, (node: Node) => {
						if (node.type === 'ExportNamedDeclaration') {
							if (
								isExperimentalEdgeRuntimeExport(node) ||
								isConfigExperimentalEdgeRuntimeExport(node)
							) {
								exportRuntimeEdgeFound = true;
								return;
							}

							isConfigExperimentalEdgeRuntimeExport(node);
						}
					});

					if (nonFalseFallbackValue && !exportRuntimeEdgeFound) {
						context.report({
							message:
								'`getStaticPaths` cannot set `fallback` to anything but `false` without opting in to the edge runtime',
							node: nonFalseFallbackValue,
						});
					}
				}
			},
		};
	},
	meta: {
		fixable: 'code',
		docs: {
			url: 'https://github.com/cloudflare/next-on-pages/blob/main/packages/eslint-plugin-next-on-pages/docs/rules/no-pages-nodejs-dynamic-ssg.md',
		},
	},
};

export = rule;

/**
 * Given an objectExpression retrieves a non-false literal property node value from such object is present
 *
 * @param node ObjectExpression node to check
 * @returns the non-false node value if present, null otherwise
 */
function getNonFalseFallbackPropIfPresent(node: ObjectExpression): Node | null {
	const fallbackProp = node.properties.find(
		prop =>
			prop.type === 'Property' &&
			prop.key.type === 'Identifier' &&
			prop.key.name === 'fallback',
	) as Property | undefined;

	if (
		fallbackProp?.value.type === 'Literal' &&
		fallbackProp?.value.value !== false
	) {
		return fallbackProp.value;
	}
	return null;
}

/**
 * Identifies if an exported named declaration node represents:
 *  `export const runtime = 'experimental-edge';`
 *
 * @param node the target node
 * @returns a boolean indicating if the node represents the code or not
 */
function isExperimentalEdgeRuntimeExport(node: ExportNamedDeclaration) {
	return (
		node.declaration?.type === 'VariableDeclaration' &&
		node.declaration.declarations.length === 1 &&
		node.declaration.declarations[0]?.id.type === 'Identifier' &&
		node.declaration.declarations[0].id.name === 'runtime' &&
		node.declaration.declarations[0].init?.type === 'Literal' &&
		node.declaration.declarations[0].init?.value === 'experimental-edge'
	);
}

/**
 * Identifies if an exported named declaration node represents:
 *  `export const config = { runtime: 'experimental-edge' };`
 *
 * @param node the target node
 * @returns a boolean indicating if the node represents the code or not
 */
function isConfigExperimentalEdgeRuntimeExport(node: ExportNamedDeclaration) {
	if (
		node.declaration?.type === 'VariableDeclaration' &&
		node.declaration.declarations.length === 1 &&
		node.declaration.declarations[0]?.id.type === 'Identifier' &&
		node.declaration.declarations[0].id.name === 'config' &&
		node.declaration.declarations[0].init?.type === 'ObjectExpression'
	) {
		const configObj = node.declaration.declarations[0].init;

		const runtimeProp = configObj.properties.find(
			prop =>
				prop.type === 'Property' &&
				prop.key.type === 'Identifier' &&
				prop.key.name === 'runtime',
		) as Property | undefined;

		if (
			runtimeProp?.value.type === 'Literal' &&
			runtimeProp?.value.value === 'experimental-edge'
		) {
			return true;
		}
	}
	return false;
}
