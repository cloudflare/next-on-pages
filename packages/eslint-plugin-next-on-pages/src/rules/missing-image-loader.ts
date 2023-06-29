import type { Rule } from 'eslint';
import type { Node, Program } from 'estree';

const rule: Rule.RuleModule = {
	create: context => {
		const ast = context.sourceCode.ast;
		const imageComponentName = getImportedImageName(ast);

		return {
			JSXElement: (node: Node) => {
				if (!imageComponentName) {
					// We could not find an imported name for the Image component, it's likely actually not imported so we can skip this file
					return;
				}

				if (
					node.type !== 'JSXElement' ||
					node.openingElement.name.type !== 'JSXIdentifier' ||
					node.openingElement.name.name !== imageComponentName
				) {
					return;
				}

				const loaderAttr = node.openingElement.attributes.find(
					attr =>
						attr.type === 'JSXAttribute' &&
						attr.name.type === 'JSXIdentifier' &&
						attr.name.name === 'loader' &&
						attr.value?.type === 'JSXExpressionContainer'
				);
				if (!loaderAttr) {
					context.report({
						message: 'No custom loader specified for the Image element.',
						node: node.openingElement.name as unknown as Node,
					});
				}
			},
		};
	},
	meta: {
		fixable: 'code',
		docs: {
			url: 'https://github.com/cloudflare/next-on-pages/blob/main/packages/eslint-plugin-next-on-pages/docs/rules/missing-image-loader.md',
		},
	},
};

export = rule;

/**
 * Gets the name used to import the Image component from 'next/image'
 * (it can either be `import Image from 'next/image'` or `import * as ... from 'next/image'`)
 */
function getImportedImageName(ast: Program): string | null {
	for (const node of ast.body) {
		if (
			node.type === 'ImportDeclaration' &&
			node.source.type === 'Literal' &&
			node.source.value === 'next/image' &&
			(node.specifiers[0]?.type === 'ImportDefaultSpecifier' ||
				node.specifiers[0]?.type === 'ImportNamespaceSpecifier')
		) {
			return node.specifiers[0].local.name;
		}
	}
	return null;
}
