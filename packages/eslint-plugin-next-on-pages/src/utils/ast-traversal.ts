import type { Rule } from 'eslint';
import type { Node, Program } from 'estree';

type NodeWithParent = Node & { parent?: Node };

/**
 * Traverses an AST upwards by following the nodes' parents to search for the root Program node
 *
 * @param node the node to start the search from
 * @returns the Program node or null if none was found
 */
export function getProgramNode(node: NodeWithParent): Program | null {
	let currentNode: NodeWithParent = node;

	if (currentNode.type === 'Program') {
		return currentNode;
	}

	while (currentNode.parent) {
		currentNode = currentNode.parent;
		if (currentNode.type === 'Program') {
			return currentNode;
		}
	}

	return null;
}

/**
 * Utility to traverse and AST and run a visitor logic on all the node of said AST
 *
 * @note The function comes from https://github.com/discord/eslint-traverse/blob/master/index.js
 *       (plus some minor tweaks/simplifications and types support)
 *
 * @param allVisitorKeys all the visitor keys for the AST traversal
 * @param node the node from where to start traversing the AST
 * @param visitor callback that gets run against each visited node
 */
export function traverseAST(
	allVisitorKeys: Rule.RuleContext['sourceCode']['visitorKeys'],
	node: Node,
	visitor: (node: Node) => void,
): void {
	const queue: Node[] = [node];

	while (queue.length) {
		const currentNode = queue.shift();

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		visitor(currentNode!);

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const visitorKeys = allVisitorKeys[currentNode!.type];
		if (!visitorKeys) {
			continue;
		}

		visitorKeys.forEach(visitorKey => {
			const child = (currentNode as unknown as Record<string, Node>)[
				visitorKey
			];
			if (!child) {
				return;
			}

			if (Array.isArray(child)) {
				for (const item of child) {
					queue.push(item);
				}
				return;
			}

			queue.push(child);
		});
	}
}
