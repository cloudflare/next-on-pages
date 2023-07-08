import type { Node } from 'acorn';
import type * as AST from 'ast-types/gen/kinds';
import type { ProcessVercelFunctionsOpts } from '.';

/**
 * Collects the identifiers from the AST and adds them to the provided map and list.
 *
 * @param collectedIdentifiers The collected identifiers.
 * @param program The AST for the function file.
 * @param opts The options for the function processing.
 */
export function collectIdentifiers(
	{ identifierMaps, programIdentifiers }: CollectIdentifiersOpts,
	program: AST.ProgramKind,
	{ disableChunksDedup }: Partial<ProcessVercelFunctionsOpts>
): void {
	// Wasm
	collectIdentifierType(
		{ programIdentifiers, foundIdentifiers: identifierMaps.wasm },
		program,
		extractWasm
	);

	// Manifests
	collectIdentifierType(
		{ programIdentifiers, foundIdentifiers: identifierMaps.manifest },
		program,
		extractManifest
	);

	// Webpack chunks
	if (!disableChunksDedup) {
		collectIdentifierType(
			{ programIdentifiers, foundIdentifiers: identifierMaps.webpack },
			program,
			extractWebpack
		);
	}
}

type CollectIdentifiersOpts = {
	identifierMaps: Record<IdentifierType, IdentifiersMap>;
	programIdentifiers: ProgramIdentifiers;
};

/**
 * Collects the identifiers from the AST and adds them to the provided map and list.
 *
 * @param collectedIdentifiers The collected identifiers.
 * @param program The AST for the function file.
 * @param callback A function that extracts the identifiers from a statement.
 * @returns A map of the Wasm identifiers.
 */
function collectIdentifierType<T extends IdentifierType>(
	{ foundIdentifiers, programIdentifiers }: CollectIdentifierTypeOpts,
	program: AST.ProgramKind,
	callback: (
		statement: AST.StatementKind
	) => RawIdentifier<T> | null | RawIdentifier<T>[]
): void {
	const rawIdentifiers = program.body
		.map(callback)
		.flat()
		.filter(Boolean) as RawIdentifier<T>[];

	const uniqueIdentifiers = new Set<string>();
	for (const ident of rawIdentifiers) {
		programIdentifiers.push(ident);

		const existing = foundIdentifiers.get(ident.identifier);
		if (!existing) {
			foundIdentifiers.set(ident.identifier, { consumers: 1 });
		} else if (!uniqueIdentifiers.has(ident.identifier)) {
			existing.consumers += 1;
		} else {
			// TODO: Proper collision error message.
			process.exit(1);
		}

		uniqueIdentifiers.add(ident.identifier);
	}
}

type CollectIdentifierTypeOpts = {
	foundIdentifiers: IdentifiersMap;
	programIdentifiers: ProgramIdentifiers;
};

export type IdentifierType = 'wasm' | 'manifest' | 'webpack';
export type RawIdentifier<T extends IdentifierType> = {
	type: T;
	identifier: string;
	start: number;
	end: number;
	importPath?: string;
};

export type IdentifiersMap = Map<
	string,
	{ consumers: number; newDest?: string }
>;
export type ProgramIdentifiers = RawIdentifier<IdentifierType>[];

/**
 * In the Vercel build output we get top level statement such as:
 *   const wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 = require("/wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm");
 * those identifiers are used in the various chunks, this function checks the provided statement and collects the identifier
 * name and path so that we can tweak it and replace it with a standard esm import and add it to the chunk using it instead.
 *
 * meaning that practically we take the
 *   const wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 = require("/wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm");
 * from the route js file and add at the top of the chunk files using wasm_fbeb8adedbc833032bda6f13925ba235b8d09114
 * the following import:
 *   import wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 from "../wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm";
 *
 * @param statement The AST statement to check.
 * @returns The Wasm identifier information.
 */
function extractWasm(
	statement: AST.StatementKind
): RawIdentifier<'wasm'> | null {
	if (
		statement.type !== 'VariableDeclaration' ||
		statement.declarations.length !== 1 ||
		statement.declarations[0]?.type !== 'VariableDeclarator' ||
		statement.declarations[0].id.type !== 'Identifier' ||
		statement.declarations[0].init?.type !== 'CallExpression' ||
		statement.declarations[0].init.callee.type !== 'Identifier' ||
		statement.declarations[0].init.callee.name !== 'require' ||
		statement.declarations[0].init.arguments.length !== 1 ||
		statement.declarations[0].init.arguments[0]?.type !== 'Literal' ||
		typeof statement.declarations[0].init.arguments[0]?.value !== 'string'
	) {
		return null;
	}

	const identifier = statement.declarations[0].id.name;
	const importPath = statement.declarations[0].init.arguments[0].value;
	const { start, end } = statement as unknown as Node;

	return { type: 'wasm', identifier, start, end, importPath };
}

/**
 * Extracts statement manifest information (i.e. the manifest identifier and the start and end locations of the statement)
 * from an AST statement representing the following format: "self.MANIFEST_NAME = { MANIFEST_CONTENT }"
 * where MANIFEST_NAME is one of the name of the manifests that Next.js generates and MANIFEST_CONTENT is its content in js object form
 *
 * @param statement The AST statement to check.
 * @returns The manifest identifier information.
 */
function extractManifest(
	statement: AST.StatementKind
): RawIdentifier<'manifest'> | null {
	if (
		statement.type !== 'ExpressionStatement' ||
		statement.expression.type !== 'AssignmentExpression' ||
		statement.expression.left.type !== 'MemberExpression' ||
		statement.expression.left.object.type !== 'Identifier' ||
		statement.expression.left.object.name !== 'self' ||
		statement.expression.left.property.type !== 'Identifier'
	)
		return null;

	const nextJsManifests = [
		'__RSC_SERVER_MANIFEST',
		'__RSC_MANIFEST',
		'__RSC_CSS_MANIFEST',
		'__BUILD_MANIFEST',
		'__REACT_LOADABLE_MANIFEST',
		'__NEXT_FONT_MANIFEST',
	];
	if (!nextJsManifests.includes(statement.expression.left.property.name))
		return null;

	const identifier = statement.expression.left.property.name;
	const { start, end } = statement as unknown as Node;

	return { type: 'manifest', identifier, start, end };
}

/**
 * Verifies wether the provided AST statement represents a javascript code
 * of the following format:
 * 	```
 * 		(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push(...,
 * 			{
 * 				[chunkNumberA]: e => { ... },
 * 				[chunkNumberB]: e => { ... },
 * 				[chunkNumberC]: e => { ... },
 * 				...
 * 			}
 * 		]);
 *  ```
 * and in such case it extracts the various chunk properties.
 *
 * @param statement The AST statement to check
 * @returns An array of Webpack chunk identifier information.
 */
function extractWebpack(
	statement: AST.StatementKind
): RawIdentifier<'webpack'>[] {
	if (
		statement.type !== 'ExpressionStatement' ||
		statement.expression.type !== 'CallExpression' ||
		statement.expression.callee.type !== 'MemberExpression' ||
		statement.expression.callee.property.type !== 'Identifier' ||
		statement.expression.callee.property.name !== 'push' ||
		statement.expression.callee.object.type !== 'AssignmentExpression' ||
		!isSelfWebpackChunk_N_E(statement.expression.callee.object.left) ||
		statement.expression.callee.object.right.type !== 'LogicalExpression' ||
		!isSelfWebpackChunk_N_E(statement.expression.callee.object.right.left) ||
		statement.expression.callee.object.right.right.type !== 'ArrayExpression' ||
		statement.expression.callee.object.right.right.elements.length !== 0 ||
		statement.expression.arguments[0]?.type !== 'ArrayExpression' ||
		statement.expression.arguments[0].elements[1]?.type !== 'ObjectExpression'
	) {
		return [];
	}

	const properties =
		statement.expression.arguments[0].elements[1].properties.filter(
			p =>
				p.type === 'Property' &&
				p.key.type === 'Literal' &&
				typeof p.key.value === 'number' &&
				p.value.type === 'ArrowFunctionExpression'
		) as AST.PropertyKind[];

	return properties.map(chunk => ({
		type: 'webpack',
		identifier: (chunk.key as AST.NumericLiteralKind).value.toString(),
		start: (chunk.value as Node).start,
		end: (chunk.value as Node).end,
	}));
}

/**
 * Check whether the provided AST node represents `self.webpackChunk_N_E`.
 */
function isSelfWebpackChunk_N_E(expression: AST.NodeKind): boolean {
	return (
		expression.type === 'MemberExpression' &&
		expression.object.type === 'Identifier' &&
		expression.object.name === 'self' &&
		expression.property.type === 'Identifier' &&
		expression.property.name === 'webpackChunk_N_E'
	);
}
