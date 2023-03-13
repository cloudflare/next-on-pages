import { readFile, writeFile, mkdir, stat, readdir } from "fs/promises";
import { exit } from "process";
import { spawn } from "child_process";
import { dirname, join, relative, resolve } from "path";
import { build } from "esbuild";
import { tmpdir } from "os";
import { watch } from "chokidar";
import pLimit from "p-limit";
import acorn, { parse, Node } from "acorn";
import { generate } from "astring";

type LooseNode = Node & {
  expression?: LooseNode;
  callee?: LooseNode;
  object?: LooseNode;
  left?: LooseNode;
  right?: LooseNode;
  property?: LooseNode;
  arguments?: LooseNode[];
  elements?: LooseNode[];
  properties?: LooseNode[];
  key?: LooseNode;
  name?: string;
  value: any;
};

const prepVercel = async () => {
  try {
    await stat(".vercel/project.json");
  } catch {
    await mkdir(".vercel", { recursive: true });
    await writeFile(
      ".vercel/project.json",
      JSON.stringify({ projectId: "_", orgId: "_", settings: {} })
    );
  }
  console.log("⚡️");
  console.log("⚡️ Installing 'vercel' CLI...");
  console.log("⚡️");

  const vercelBuild = spawn("npm", ["install", "-D", "vercel"]);

  vercelBuild.stdout.on("data", (data) => {
    const lines: string[] = data.toString().split("\n");
    lines.map((line) => {
      console.log(`▲ ${line}`);
    });
  });

  vercelBuild.stderr.on("data", (data) => {
    const lines: string[] = data.toString().split("\n");
    lines.map((line) => {
      console.log(`▲ ${line}`);
    });
  });

  await new Promise((resolve, reject) => {
    vercelBuild.on("close", (code) => {
      if (code === 0) {
        resolve(null);
      } else {
        reject();
      }
    });
  });

  console.log("⚡️");
  console.log("⚡️");
  console.log("⚡️ Completed 'npx vercel build'.");
  console.log("⚡️");
};

const buildVercel = async () => {
  console.log("⚡️");
  console.log("⚡️ Building project with 'npx vercel build'...");
  console.log("⚡️");

  const vercelBuild = spawn("npx", ["vercel", "build"]);

  vercelBuild.stdout.on("data", (data) => {
    const lines: string[] = data.toString().split("\n");
    lines.map((line) => {
      console.log(`▲ ${line}`);
    });
  });

  vercelBuild.stderr.on("data", (data) => {
    const lines: string[] = data.toString().split("\n");
    lines.map((line) => {
      console.log(`▲ ${line}`);
    });
  });

  await new Promise((resolve, reject) => {
    vercelBuild.on("close", (code) => {
      if (code === 0) {
        resolve(null);
      } else {
        reject();
      }
    });
  });

  console.log("⚡️");
  console.log("⚡️");
  console.log("⚡️ Completed 'npx vercel build'.");
  console.log("⚡️");
};

interface MiddlewareManifest {
  sortedMiddleware: string[];
  middleware: Record<
    string,
    {
      env: string[];
      files: string[];
      name: string;
      matchers: { regexp: string }[];
      wasm: [];
      assets: [];
    }
  >;
  functions: Record<
    string,
    {
      env: string[];
      files: string[];
      name: string;
      page: string;
      matchers: { regexp: string }[];
      wasm: [];
      assets: [];
    }
  >;
  version: 2;
}

const transform = async ({
  experimentalMinify,
}: {
  experimentalMinify: boolean;
}) => {
  let config;
  try {
    config = JSON.parse(await readFile(".vercel/output/config.json", "utf8"));
  } catch {
    console.error(
      "⚡️ ERROR: Could not read the '.vercel/output/config.json' file."
    );
    exit(1);
  }

  if (config.version !== 3) {
    console.error(
      `⚡️ ERROR: Unknown '.vercel/output/config.json' version. Expected 3 but found ${config.version}.`
    );
    console.error(
      `⚡️ Please report this at https://github.com/cloudflare/next-on-pages/issues.`
    );
    exit(1);
  }

  const functionsDir = resolve(".vercel/output/functions");
  let functionsExist = false;
  try {
    await stat(functionsDir);
    functionsExist = true;
  } catch {}

  if (!functionsExist) {
    console.log("⚡️ No functions detected.");
    return;
  }

  const functionsMap = new Map<string, string>();

  const tmpFunctionsDir = join(tmpdir(), Math.random().toString(36).slice(2));
  const tmpWebpackDir = join(tmpdir(), Math.random().toString(36).slice(2));

  const invalidFunctions: string[] = [];

  const webpackChunks = new Map<number, string>();

  const walk = async (dir: string) => {
    const files = await readdir(dir);

    await Promise.all(
      files.map(async (file) => {
        const filepath = join(dir, file);
        const isDirectory = (await stat(filepath)).isDirectory();
        const relativePath = relative(functionsDir, filepath);

        if (isDirectory && filepath.endsWith(".func")) {
          const name = relativePath.replace(/\.func$/, "");

          const functionConfigFile = join(filepath, ".vc-config.json");
          let functionConfig: { runtime: "edge"; entrypoint: string };
          try {
            let contents = await readFile(functionConfigFile, "utf8");
            functionConfig = JSON.parse(contents);
          } catch {
            invalidFunctions.push(file);
            return;
          }

          if (functionConfig.runtime !== "edge") {
            invalidFunctions.push(name);
            return;
          }

          const functionFile = join(filepath, functionConfig.entrypoint);
          let functionFileExists = false;
          try {
            await stat(functionFile);
            functionFileExists = true;
          } catch {}

          if (!functionFileExists) {
            invalidFunctions.push(name);
            return;
          }

          let contents = await readFile(functionFile, "utf8");
          contents = contents.replace(
            // TODO: This hack is not good. We should replace this with something less brittle ASAP
            /(Object.defineProperty\(globalThis,\s*"__import_unsupported",\s*{[\s\S]*?configurable:\s*)([^,}]*)(.*}\s*\))/gm,
            "$1true$3"
          );

          if (experimentalMinify) {
            const parsedContents = parse(contents, {
              ecmaVersion: "latest",
              sourceType: "module",
            }) as Node & { body: LooseNode[] };

            const expressions = parsedContents.body
              .filter(
                ({ type, expression }) =>
                  type === "ExpressionStatement" &&
                  expression?.type === "CallExpression" &&
                  expression.callee?.type === "MemberExpression" &&
                  expression.callee.object?.type === "AssignmentExpression" &&
                  expression.callee.object.left?.object?.name === "self" &&
                  expression.callee.object.left.property?.name ===
                    "webpackChunk_N_E" &&
                  expression.arguments?.[0]?.elements?.[1]?.type ===
                    "ObjectExpression"
              )
              .map(
                (node) =>
                  node?.expression?.arguments?.[0]?.elements?.[1]?.properties
              ) as LooseNode[][];

            for (const objectOfChunks of expressions) {
              for (const chunkExpression of objectOfChunks) {
                const key = chunkExpression?.key?.value;
                if (key in webpackChunks) {
                  if (
                    webpackChunks.get(key) !== generate(chunkExpression.value)
                  ) {
                    console.error(
                      "⚡️ ERROR: Detected a collision with '--experimental-minify'."
                    );
                    console.error(
                      "⚡️ Try removing the '--experimental-minify' argument."
                    );
                    console.error(
                      "⚡️ Please report this at https://github.com/cloudflare/next-on-pages/issues."
                    );
                    exit(1);
                  }
                }

                webpackChunks.set(key, generate(chunkExpression.value));

                const chunkFilePath = join(tmpWebpackDir, `${key}.js`);

                const newValue = {
                  type: "MemberExpression",
                  object: {
                    type: "CallExpression",
                    callee: {
                      type: "Identifier",
                      name: "require",
                    },
                    arguments: [
                      {
                        type: "Literal",
                        value: chunkFilePath,
                        raw: JSON.stringify(chunkFilePath),
                      },
                    ],
                  },
                  property: { type: "Identifier", name: "default" },
                };

                chunkExpression.value = newValue;
              }
            }

            contents = generate(parsedContents);
          }

          const newFilePath = join(tmpFunctionsDir, `${relativePath}.js`);
          await mkdir(dirname(newFilePath), { recursive: true });
          await writeFile(newFilePath, contents);

          functionsMap.set(
            relative(functionsDir, filepath).slice(0, -".func".length),
            newFilePath
          );
        } else if (isDirectory) {
          await walk(filepath);
        }
      })
    );
  };

  await walk(functionsDir);

  for (const [chunkIdentifier, code] of webpackChunks) {
    const chunkFilePath = join(tmpWebpackDir, `${chunkIdentifier}.js`);
    await mkdir(dirname(chunkFilePath), { recursive: true });
    await writeFile(chunkFilePath, `export default ${code}`);
  }

  if (functionsMap.size === 0) {
    console.log("⚡️ No functions detected.");
    return;
  }

  let middlewareManifest: MiddlewareManifest;
  try {
    // Annoying that we don't get this from the `.vercel` directory.
    // Maybe we eventually just construct something similar from the `.vercel/output/functions` directory with the same magic filename/precendence rules?
    middlewareManifest = JSON.parse(
      await readFile(".next/server/middleware-manifest.json", "utf8")
    );
  } catch {
    console.error("⚡️ ERROR: Could not read the functions manifest.");
    exit(1);
  }

  if (middlewareManifest.version !== 2) {
    console.error(
      `⚡️ ERROR: Unknown functions manifest version. Expected 2 but found ${middlewareManifest.version}.`
    );
    console.error(
      "⚡️ Please report this at https://github.com/cloudflare/next-on-pages/issues."
    );
    exit(1);
  }

  const hydratedMiddleware = new Map<
    string,
    {
      matchers: { regexp: string }[];
      filepath: string;
    }
  >();
  const hydratedFunctions = new Map<
    string,
    {
      matchers: { regexp: string }[];
      filepath: string;
    }
  >();

  const middlewareEntries = Object.values(middlewareManifest.middleware);
  const functionsEntries = Object.values(middlewareManifest.functions);
  for (const [name, filepath] of functionsMap) {
    if (name === "middleware" && middlewareEntries.length > 0) {
      for (const entry of middlewareEntries) {
        if ("middleware" === entry?.name) {
          hydratedMiddleware.set(name, { matchers: entry.matchers, filepath });
        }
      }
    }

    for (const entry of functionsEntries) {
      if (
        `pages/${name}` === entry?.name ||
        `app${name !== "index" ? `/${name}` : ""}/page` === entry?.name
      ) {
        hydratedFunctions.set(name, { matchers: entry.matchers, filepath });
      }
    }
  }

  const rscFunctions = [...functionsMap.keys()].filter((name) =>
    name.endsWith(".rsc")
  );

  if (
    hydratedMiddleware.size + hydratedFunctions.size !==
    functionsMap.size - rscFunctions.length
  ) {
    console.error(
      "⚡️ ERROR: Could not map all functions to an entry in the manifest."
    );
    console.error(
      "⚡️ Please report this at https://github.com/cloudflare/next-on-pages/issues."
    );
    exit(1);
  }

  if (invalidFunctions.length > 0) {
    console.error(
      "⚡️ ERROR: Failed to produce a Cloudflare Pages build from the project."
    );
    console.error(
      "⚡️ The following functions were not configured to run with the Edge Runtime:"
    );
    console.error("⚡️");
    invalidFunctions.map((invalidFunction) => {
      console.error(`⚡️  - ${invalidFunction}`);
    });
    console.error("⚡️");
    console.error("⚡️ If this is a Next.js project:");
    console.error("⚡️");
    console.error(
      "⚡️  - you can read more about configuring Edge API Routes here (https://nextjs.org/docs/api-routes/edge-api-routes),"
    );
    console.error("⚡️");
    console.error(
      "⚡️  - you can try enabling the Edge Runtime for a specific page by exporting the following from your page:"
    );
    console.error("⚡️");
    console.error(
      "⚡️      export const config = { runtime: 'experimental-edge' };"
    );
    console.error("⚡️");
    console.error(
      "⚡️  - or you can try enabling the Edge Runtime for all pages in your project by adding the following to your 'next.config.js' file:"
    );
    console.error("⚡️");
    console.error(
      "⚡️      const nextConfig = { experimental: { runtime: 'experimental-edge'} };"
    );
    console.error("⚡️");
    console.error(
      "⚡️ You can read more about the Edge Runtime here: https://nextjs.org/docs/advanced-features/react-18/switchable-runtime"
    );
    exit(1);
  }

  const functionsFile = join(
    tmpdir(),
    `functions-${Math.random().toString(36).slice(2)}.js`
  );

  await writeFile(
    functionsFile,
    `
    export const __FUNCTIONS__ = {${[...hydratedFunctions.entries()]
      .map(
        ([name, { matchers, filepath }]) =>
          `"${name}": { matchers: ${JSON.stringify(
            matchers
          )}, entrypoint: require('${filepath}')}`
      )
      .join(",")}};
      
      export const __MIDDLEWARE__ = {${[...hydratedMiddleware.entries()]
        .map(
          ([name, { matchers, filepath }]) =>
            `"${name}": { matchers: ${JSON.stringify(
              matchers
            )}, entrypoint: require('${filepath}')}`
        )
        .join(",")}};`
  );

  await build({
    entryPoints: [join(__dirname, "../templates/_worker.js")],
    bundle: true,
    inject: [
      join(__dirname, "../templates/_worker.js/globals.js"),
      functionsFile,
    ],
    target: "es2021",
    platform: "neutral",
    define: {
      __CONFIG__: JSON.stringify(config),
    },
    outfile: ".vercel/output/static/_worker.js",
    minify: experimentalMinify,
  });

  console.log("⚡️ Generated '.vercel/output/static/_worker.js'.");
};

const help = () => {
  console.log("⚡️");
  console.log("⚡️ Usage: npx @cloudflare/next-on-pages [options]");
  console.log("⚡️");
  console.log("⚡️ Options:");
  console.log("⚡️");
  console.log("⚡️   --help:                Shows this help message");
  console.log("⚡️");
  console.log(
    "⚡️   --skip-build:          Doesn't run 'vercel build' automatically"
  );
  console.log("⚡️");
  console.log(
    "⚡️   --experimental-minify: Attempts to minify the functions of a project (by de-duping webpack chunks)"
  );
  console.log("⚡️");
  console.log(
    "⚡️   --watch:               Automatically rebuilds when the project is edited"
  );
  console.log("⚡️");
  console.log("⚡️");
  console.log("⚡️ GitHub: https://github.com/cloudflare/next-on-pages");
  console.log(
    "⚡️ Docs: https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/"
  );
};

const main = async ({
  skipBuild,
  experimentalMinify,
}: {
  skipBuild: boolean;
  experimentalMinify: boolean;
}) => {
  if (!skipBuild) {
    await prepVercel();
    await buildVercel();
  }

  await transform({ experimentalMinify });
};

(async () => {
  console.log("⚡️ @cloudflare/next-on-pages CLI");

  if (process.argv.includes("--help")) {
    help();
    return;
  }

  const skipBuild = process.argv.includes("--skip-build");
  const experimentalMinify = process.argv.includes("--experimental-minify");
  const limit = pLimit(1);

  if (process.argv.includes("--watch")) {
    watch(".", {
      ignored: [
        ".git",
        "node_modules",
        ".vercel",
        ".next",
        "package-lock.json",
        "yarn.lock",
      ],
      ignoreInitial: true,
    }).on("all", () => {
      if (limit.pendingCount === 0) {
        limit(() =>
          main({ skipBuild, experimentalMinify }).then(() => {
            console.log("⚡️");
            console.log(
              "⚡️ Running in '--watch' mode. Awaiting changes... (Ctrl+C to exit.)"
            );
          })
        );
      }
    });
  }

  limit(() =>
    main({ skipBuild, experimentalMinify }).then(() => {
      if (process.argv.includes("--watch")) {
        console.log("⚡️");
        console.log(
          "⚡️ Running in '--watch' mode. Awaiting changes... (Ctrl+C to exit.)"
        );
      }
    })
  );
})();
