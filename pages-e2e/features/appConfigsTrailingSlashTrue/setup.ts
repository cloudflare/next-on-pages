import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import * as recast from 'recast';

import { copyWorkspaceAssets } from '../_utils/copyWorkspaceAssets';

await copyWorkspaceAssets();

const { WORKSPACE_DIR } = process.env;

const nextConfigJsPath = join(WORKSPACE_DIR, 'next.config.js');

const nextConfigJsSource = await readFile(nextConfigJsPath, 'utf-8');

const ast = recast.parse(nextConfigJsSource);

recast.visit(ast, {
	visitVariableDeclaration: function (path) {
	  if (
		path?.value?.declarations.length === 1 &&
		path.value.declarations[0].id.name === 'nextConfig'
	  ) {
		const nextConfigAst = path.value.declarations[0].init;
  
		const { property, identifier, booleanLiteral } = recast.types.builders;
  
		var trailingSlashProp = property.from({
		  kind: 'init',
		  key: identifier('trailingSlash'),
		  value: booleanLiteral(true),
		});
  
		nextConfigAst.properties.push(trailingSlashProp);
	  }
	  this.traverse(path);
	},
});

await writeFile(nextConfigJsPath, recast.print(ast).code);
