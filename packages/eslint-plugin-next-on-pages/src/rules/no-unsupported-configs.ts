import type { Rule, SourceCode } from 'eslint';
import type { Node, Property } from 'estree';
import { extractPaths } from '../utils/extract-paths';
import { parse as parseComment } from 'comment-parser';

// Note: the rule now only checks for property name, it will probably need to also include case in which we do accept a property but not
//       certain values for it

type Config = { name: string; support: '✅' | 'N/A' | '❌' | '🔄' };

// configs taken from https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/supported.md#nextconfigjs-properties
// NOTE: to some we need to add the `experimental/` prefix and the Runtime Config is split into two
const configs: Config[] = [
	{ name: 'experimental/appDir', support: '✅' },
	{ name: 'assetPrefix', support: '🔄' },
	{ name: 'basePath', support: '✅' },
	{ name: 'compress', support: 'N/A' },
	{ name: 'devIndicators', support: 'N/A' },
	{ name: 'distDir', support: 'N/A' },
	{ name: 'env', support: '✅' },
	{ name: 'eslint', support: '✅' },
	{ name: 'exportPathMap', support: 'N/A' },
	{ name: 'generateBuildId', support: '✅' },
	{ name: 'generateEtags', support: '🔄' },
	{ name: 'headers', support: '✅' },
	{ name: 'httpAgentOptions', support: 'N/A' },
	{ name: 'images', support: '✅' },
	{ name: 'incrementalCacheHandlerPath', support: '🔄' },
	{ name: 'logging', support: 'N/A' },
	{ name: 'experimental/mdxRs', support: '✅' },
	{ name: 'onDemandEntries', support: 'N/A' },
	{ name: 'experimental/optimizePackageImports', support: 'N/A' },
	{ name: 'output', support: 'N/A' },
	{ name: 'pageExtensions', support: '✅' },
	{ name: 'experimental/ppr', support: '❌' },
	{ name: 'poweredByHeader', support: '🔄' },
	{ name: 'productionBrowserSourceMaps', support: '🔄' },
	{ name: 'reactStrictMode', support: '❌' },
	{ name: 'redirects', support: '✅' },
	{ name: 'rewrites', support: '✅' },
	// Runtime Config
	{ name: 'serverRuntimeConfig', support: '❌' },
	{ name: 'publicRuntimeConfig', support: '❌' },
	{ name: 'experimental/serverActions', support: '✅' },
	{ name: 'serverComponentsExternalPackages', support: 'N/A' },
	{ name: 'trailingSlash', support: '✅' },
	{ name: 'transpilePackages', support: '✅' },
	{ name: 'experimental/turbo', support: '🔄' },
	{ name: 'typedRoutes', support: '✅' },
	{ name: 'typescript', support: '✅' },
	{ name: 'experimental/urlImports', support: '✅' },
	{ name: 'webpack', support: '✅' },
	{ name: 'experimental/webVitalsAttribution', support: '✅' },
];

function filterAndExtractConfigs(
	support: Config['support'] | Config['support'][],
): string[] {
	const comparisonFn = (config: Config) =>
		Array.isArray(support)
			? support.includes(config.support)
			: config.support === support;
	return configs.filter(comparisonFn).map(config => config.name);
}

const supportedConfigs = new Set(filterAndExtractConfigs('✅'));
const indefinitelyUnsupportedConfigs = new Set(
	filterAndExtractConfigs(['❌', 'N/A']),
);
const currentlyUnsupportedConfigs = new Set(filterAndExtractConfigs('🔄'));

/** nested Next.js configs that need to be explored
 * (For example 'experimental' because there are props such as 'experimental/appDir' and 'experimental/turbo')
 */
const nestedConfigPaths: Readonly<Set<string>> = new Set(
	[
		...supportedConfigs,
		...indefinitelyUnsupportedConfigs,
		...currentlyUnsupportedConfigs,
	].flatMap(extractPaths),
);

const ruleSchema = {
	type: 'object',
	properties: {
		includeCurrentlyUnsupported: {
			type: 'boolean',
			default: true,
		},
		includeUnrecognized: {
			type: 'boolean',
			default: false,
		},
	},
};

const rule: Rule.RuleModule = {
	create: context => {
		const code = context.sourceCode;
		const exportedConfigName = context.filename.match(/next\.config\.m?js$/)
			? getConfigVariableName(code)
			: null;

		const options = (context.options[0] ?? {
			includeCurrentlyUnsupported:
				ruleSchema.properties.includeCurrentlyUnsupported.default,
			includeUnrecognized: ruleSchema.properties.includeUnrecognized.default,
		}) as {
			includeCurrentlyUnsupported: boolean;
			includeUnrecognized: boolean;
		};

		return {
			VariableDeclaration: node => {
				if (!exportedConfigName) {
					// We could not find an exported config with an identifier so there no variable to check
					return;
				}

				if (
					node.declarations[0]?.id.type === 'Identifier' &&
					node.declarations[0].id.name === exportedConfigName &&
					node.declarations[0].init?.type === 'ObjectExpression'
				) {
					const nextConfigProps = node.declarations[0].init.properties.filter(
						p => p.type === 'Property',
					) as Property[];
					checkConfigPropsRecursively(nextConfigProps, context, options);
				}
			},
			ExpressionStatement: node => {
				const exportedValue = extractModuleExportValue(node);
				if (exportedValue?.type === 'ObjectExpression') {
					const nextConfigProps = exportedValue.properties.filter(
						p => p.type === 'Property',
					) as Property[];
					checkConfigPropsRecursively(nextConfigProps, context, options);
				}
			},
		};
	},
	meta: {
		schema: [ruleSchema],
		fixable: 'code',
		docs: {
			url: 'https://github.com/cloudflare/next-on-pages/blob/main/packages/eslint-plugin-next-on-pages/docs/rules/no-unsupported-configs.md',
		},
	},
};

export = rule;

function checkConfigPropsRecursively(
	nextConfigProps: Property[],
	context: Rule.RuleContext,
	options: {
		includeCurrentlyUnsupported: boolean;
		includeUnrecognized: boolean;
	},
	propPath = '',
) {
	nextConfigProps.forEach(prop => {
		if (prop.type !== 'Property' || prop.key.type !== 'Identifier') return;

		const fullPropName = `${propPath}${prop.key.name}`;

		if (
			prop.value.type === 'ObjectExpression' &&
			nestedConfigPaths.has(fullPropName)
		) {
			const props = prop.value.properties.filter(
				p => p.type === 'Property',
			) as Property[];
			checkConfigPropsRecursively(props, context, options, `${fullPropName}/`);
			return;
		}

		if (indefinitelyUnsupportedConfigs.has(fullPropName)) {
			context.report({
				message: `The "${fullPropName}" configuration is not supported by next-on-pages (and is unlikely to be supported in the future).`,
				node: prop.key,
			});
			return;
		}

		if (currentlyUnsupportedConfigs.has(fullPropName)) {
			if (options.includeCurrentlyUnsupported) {
				context.report({
					message: `The "${fullPropName}" configuration is not currently supported by next-on-pages.`,
					node: prop.key,
				});
			}
			return;
		}

		if (options.includeUnrecognized && !supportedConfigs.has(fullPropName)) {
			context.report({
				message: `The "${fullPropName}" configuration is not recognized by next-on-pages (it might or might not be supported).`,
				node: prop.key,
			});
			return;
		}
	});
}

/**
 * Gets the name of the config variable defined in next.config.mjs
 *
 * It does that by trying two different strategies:
 *  - First it tries to take the config's name from the `module.exports = ...` line
 *  - If the above attempt fails then it tries to get the variable name of the variable
 *    declared just after the next.js import type comment: "type {import('next').NextConfig}"
 *
 * @param code SourceCode of the target file
 * @returns the detected config name, or null if no name could be detected
 */
function getConfigVariableName(code: SourceCode): string | null {
	const { ast } = code;
	for (const node of ast.body) {
		const exportedValue = extractModuleExportValue(node);
		if (exportedValue?.type === 'Identifier') {
			return exportedValue.name;
		}
		const esmExportedValue = extractESMExportValue(node);
		if (esmExportedValue?.type === 'Identifier') {
			return esmExportedValue.name;
		}
	}

	const nodeAfterNextConfigComment = getNodeAfterNextConfigTypeComment(code);

	if (
		nodeAfterNextConfigComment?.type === 'VariableDeclaration' &&
		nodeAfterNextConfigComment.declarations.length === 1 &&
		nodeAfterNextConfigComment.declarations[0]?.id.type === 'Identifier'
	) {
		return nodeAfterNextConfigComment.declarations[0]?.id.name;
	}

	return null;
}

/**
 * Gets an AST node present right after the Next config type import: "import('next').NextConfig"
 *
 * @param code SourceCode of the target file
 * @returns the AST node present right after the target comment, or null if the comment was not present or no node was after it
 */
function getNodeAfterNextConfigTypeComment(code: SourceCode): Node | null {
	return (
		code.ast.body.find(node => {
			const comments = code.getCommentsBefore(node);
			return comments.find(comment => {
				const parsedComment = parseComment(`/*${comment.value}*/`)[0];
				return parsedComment?.tags.find(
					({ tag, type }) =>
						tag === 'type' &&
						/^import\s*\(\s*(['"])next\1\s*\)\s*\.\s*NextConfig$/.test(type),
				);
			});
		}) ?? null
	);
}

/**
 * Gets the value of a node potentially representing: `module.exports = ...`
 * Returns the node of the value, or null if the input node doesn't represent the code
 */
function extractModuleExportValue(node: Node): Node | null {
	if (
		node.type === 'ExpressionStatement' &&
		node.expression.type === 'AssignmentExpression' &&
		node.expression.left.type === 'MemberExpression' &&
		node.expression.left.object.type === 'Identifier' &&
		node.expression.left.object.name === 'module' &&
		node.expression.left.property.type === 'Identifier' &&
		node.expression.left.property.name === 'exports'
	) {
		return node.expression.right;
	}

	return null;
}

/**
 * Gets the value of a node potentially representing: `export default ...`
 * Returns the node of the value, or null if the input node doesn't represent the code
 */
function extractESMExportValue(node: Node): Node | null {
	if (node.type === 'ExportDefaultDeclaration') {
		return node.declaration;
	}

	return null;
}
