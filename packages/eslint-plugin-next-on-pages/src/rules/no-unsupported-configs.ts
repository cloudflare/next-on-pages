import type { Rule } from 'eslint';
import type { Node, Program, Property } from 'estree';
import assert, { AssertionError } from 'node:assert';
import { extractPaths } from '../utils/extract-paths';

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
	{ name: 'devIndicators', support: '❌' },
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
	{ name: 'experimental/mdxRs', support: '✅' },
	{ name: 'onDemandEntries', support: 'N/A' },
	{ name: 'output', support: 'N/A' },
	{ name: 'pageExtensions', support: '✅' },
	{ name: 'poweredByHeader', support: '🔄' },
	{ name: 'productionBrowserSourceMaps', support: '🔄' },
	{ name: 'reactStrictMode', support: '❌' },
	{ name: 'redirects', support: '✅' },
	{ name: 'rewrites', support: '✅' },
	// Runtime Config
	{ name: 'serverRuntimeConfig', support: '❌' },
	{ name: 'publicRuntimeConfig', support: '❌' },
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
	support: Config['support'] | Config['support'][]
): string[] {
	const comparisonFn = (config: Config) =>
		Array.isArray(support)
			? support.includes(config.support)
			: config.support === support;
	return configs.filter(comparisonFn).map(config => config.name);
}

const supportedConfigs = new Set(filterAndExtractConfigs('✅'));
const indefinitelyUnsupportedConfigs = new Set(
	filterAndExtractConfigs(['❌', 'N/A'])
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
	].flatMap(extractPaths)
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
		const code = context.getSourceCode();
		const exportedConfigName = context.getFilename().match(/next\.config\.js$/)
			? getExportedConfigName(code.ast)
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
				try {
					const declaration = node.declarations[0];
					assert(declaration?.id.type === 'Identifier');
					assert(declaration.id.name === exportedConfigName);
					assert(declaration.init?.type === 'ObjectExpression');

					const nextConfigProps = declaration.init.properties.filter(
						p => p.type === 'Property'
					) as Property[];
					checkConfigPropsRecursively(nextConfigProps, context, options);
				} catch (e) {
					if (!(e instanceof AssertionError)) {
						throw e;
					}
				}
			},
			ExpressionStatement: node => {
				try {
					const exportedValue = extractModuleExportValue(node);
					assert(exportedValue);
					assert(exportedValue.type === 'ObjectExpression');

					const nextConfigProps = exportedValue.properties.filter(
						p => p.type === 'Property'
					) as Property[];
					checkConfigPropsRecursively(nextConfigProps, context, options);
				} catch (e) {
					if (!(e instanceof AssertionError)) {
						throw e;
					}
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
	propPath = ''
) {
	nextConfigProps.forEach(prop => {
		if (prop.type !== 'Property' || prop.key.type !== 'Identifier') return;

		const fullPropName = `${propPath}${prop.key.name}`;

		if (
			prop.value.type === 'ObjectExpression' &&
			nestedConfigPaths.has(fullPropName)
		) {
			const props = prop.value.properties.filter(
				p => p.type === 'Property'
			) as Property[];
			checkConfigPropsRecursively(props, context, options, `${fullPropName}/`);
			return;
		}

		if (indefinitelyUnsupportedConfigs.has(fullPropName)) {
			context.report({
				message: `The "${fullPropName}" configuration is not supported by next-on-pages (and will likely never be).`,
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
 * Gets the name of the config exported by next.config.js (by taking the name from the `module.exports = ...` line)
 * If no name is found it returns null
 */
function getExportedConfigName(ast: Program): string | null {
	for (const node of ast.body) {
		try {
			const exportedValue = extractModuleExportValue(node);
			assert(exportedValue);
			assert(exportedValue.type === 'Identifier');
			return exportedValue.name;
		} catch {
			/*  empty */
		}
	}
	return null;
}

/**
 * Gets the value of a node potentially representing: `module.exports = ...`
 * Returns the node of the value, or null if the input node doesn't represent the code
 */
function extractModuleExportValue(node: Node): Node | null {
	try {
		assert(node.type === 'ExpressionStatement');
		assert(node.expression.type === 'AssignmentExpression');
		assert(node.expression.left.type === 'MemberExpression');
		assert(node.expression.left.object.type === 'Identifier');
		assert(node.expression.left.object.name === 'module');
		assert(node.expression.left.property.type === 'Identifier');
		assert(node.expression.left.property.name === 'exports');
		return node.expression.right;
	} catch {
		/*  empty */
	}
	return null;
}
