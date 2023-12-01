import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import * as recast from 'recast';

import { copyWorkspaceAssets } from '../_utils/copyWorkspaceAssets';
import { redirects } from './redirects';
import { rewrites } from './rewrites';
import { headers } from './headers';

await copyWorkspaceAssets();

const { WORKSPACE_DIR } = process.env;

const nextConfigJsPath = join(WORKSPACE_DIR, 'next.config.js');

const nextConfigJsSource = await readFile(nextConfigJsPath, 'utf-8');

const ast = recast.parse(nextConfigJsSource);

recast.visit(ast, {
	visitVariableDeclaration: function (path) {
		if (
			path?.value?.declarations.length === 1 &&
			path.value.declarations[0].id?.name === 'nextConfig'
		) {
			const nextConfigAst = path.value.declarations[0].init;
			nextConfigAst.properties.push(
				generateProp('redirects'),
				generateProp('rewrites'),
				generateProp('headers'),
			);
		}
		this.traverse(path);
	},
});

await writeFile(nextConfigJsPath, recast.print(ast).code);

function generateProp(type: 'redirects' | 'rewrites' | 'headers') {
	const { property, identifier, arrowFunctionExpression } =
		recast.types.builders;

	const targetFunction = {
		redirects,
		rewrites,
		headers,
	}[type];

	const functionBody = recast.parse(targetFunction.toString()).program.body[0]
		.body;

	const fn = arrowFunctionExpression([], functionBody);
	fn.async = true;

	const prop = property.from({
		kind: 'init',
		key: identifier(type),
		value: fn,
	});

	return prop;
}
