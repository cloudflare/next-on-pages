import type { Rule } from 'eslint';
import type { Node, Program } from 'estree';
import assert, { AssertionError } from 'node:assert';

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
				try {
					assert(node.type === 'JSXElement');
					assert(node.openingElement.name.type === 'JSXIdentifier');
					assert(node.openingElement.name.name === imageComponentName);

					const loaderAttr = node.openingElement.attributes.find(
						attr =>
							attr.type === 'JSXAttribute' &&
							attr.name.type === 'JSXIdentifier' &&
							attr.name.name === 'loader' &&
							attr.value?.type === 'JSXExpressionContainer'
					);
					assert(loaderAttr === undefined);

					context.report({
						message: 'No custom loader specified for the Image element.',
						node: node.openingElement.name as unknown as Node,
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
		try {
			assert(node.type === 'ImportDeclaration');
			assert(node.source.type === 'Literal');
			assert(node.source.value === 'next/image');
			const specifier = node.specifiers[0];
			assert(specifier);
			assert(
				specifier.type === 'ImportDefaultSpecifier' ||
					specifier.type === 'ImportNamespaceSpecifier'
			);
			return specifier.local.name;
		} catch {
			/* empty */
		}
	}
	return null;
}
