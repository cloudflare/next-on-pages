/// <reference types="../setup-types" />

import { cp } from 'fs/promises';
import { join } from 'path';

const { WORKSPACE_DIR } = process.env;

await cp(
	join(process.cwd(), 'assets/api'),
	join(WORKSPACE_DIR, 'pages/api'),
	{ recursive: true }
);
