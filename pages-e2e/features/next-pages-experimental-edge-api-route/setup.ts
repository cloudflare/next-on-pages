/// <reference types="../setup-types" />

import { cp } from "fs/promises";
import { join } from "path";

const { WORKSPACE_DIR } = process.env;

await cp(
	join(process.cwd(), "assets/pages-api-hello.js"),
	join(WORKSPACE_DIR, "pages/api/hello.js")
);
