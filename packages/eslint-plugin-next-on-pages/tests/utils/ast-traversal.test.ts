import { describe, expect, test } from 'vitest';
import { traverseAST, getProgramNode } from '../../src/utils/ast-traversal';
import type { Node } from 'estree';

describe('traverseAst', () => {
	test('traverses an AST and correctly invokes the visitor callback', () => {
		const allVisitorKeys = {
			NodeA: ['NodeB', 'NodeC'],
			NodeB: [],
			NodeC: ['NodeD'],
		};
		const ast = {
			type: 'NodeA',
			NodeB: {
				type: 'NodeB',
			},
			NodeC: {
				type: 'NodeC',
				NodeD: {
					type: 'NodeD',
				},
			},
		} as unknown as Node;

		const visitedNodeTypes: string[] = [];

		traverseAST(allVisitorKeys, ast, node => {
			visitedNodeTypes.push(node.type);
		});

		expect(visitedNodeTypes).toEqual(['NodeA', 'NodeB', 'NodeC', 'NodeD']);
	});

	test("doesn't traverse anything if no visitor key is provided", () => {
		const allVisitorKeys = {};
		const ast = {
			type: 'NodeA',
			NodeB: {
				type: 'NodeB',
			},
			NodeC: {
				type: 'NodeC',
				NodeD: {
					type: 'NodeD',
				},
			},
		} as unknown as Node;

		const visitedNodeTypes: string[] = [];

		traverseAST(allVisitorKeys, ast, node => {
			visitedNodeTypes.push(node.type);
		});

		expect(visitedNodeTypes).toEqual(['NodeA']);
	});

	test("doesn't traverse nodes not accessible via visitor keys", () => {
		const allVisitorKeys = {
			NodeA: ['NodeB', 'NodeC'],
			NodeB: [],
			NodeC: [],
		};
		const ast = {
			type: 'NodeA',
			NodeB: {
				type: 'NodeB',
			},
			NodeC: {
				type: 'NodeC',
				NodeD: {
					type: 'NodeD',
				},
			},
		} as unknown as Node;

		const visitedNodeTypes: string[] = [];

		traverseAST(allVisitorKeys, ast, node => {
			visitedNodeTypes.push(node.type);
		});

		expect(visitedNodeTypes).not.toContain('NodeD');
		expect(visitedNodeTypes).toEqual(['NodeA', 'NodeB', 'NodeC']);
	});
});

describe('getProgramNode', () => {
	test('returns null if a non-program node without a parent is provided', () => {
		const ast = {
			type: 'NodeA',
			NodeB: {
				type: 'NodeB',
			},
		};

		expect(getProgramNode(ast as unknown as Node)).toBeNull();
	});

	test("returns null if an ast doesn't include a program node at all", () => {
		const ast = {
			type: 'NodeA',
			NodeB: {
				type: 'NodeB',
				NodeC: {
					type: 'NodeC',
				},
			},
		};

		expect(getProgramNode(ast.NodeB.NodeC as unknown as Node)).toBeNull();
	});

	test('returns the root program node if present', () => {
		const ast = {
			type: 'NodeA',
			NodeB: {
				type: 'NodeB',
				NodeC: {
					type: 'NodeC',
				},
			},
		};
		const program = {
			type: 'Program',
			NodeA: ast,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;

		program.NodeA.NodeB.NodeC.parent = program.NodeA.NodeB;
		program.NodeA.NodeB.parent = program.NodeA;
		program.NodeA.parent = program;

		expect(getProgramNode(program.NodeA.NodeB.NodeC)).toEqual(program);
	});
});
