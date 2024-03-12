// Generates Prisma client libraries.
//
// Wrapper around `prisma generate`

import { copy, emptyDir, resolve } from "../deps.ts";
import { buildPrismaPackage } from "./build_prisma_esm.ts";
import { Module, Project } from "../project/mod.ts";
import { forEachDatabase } from "./mod.ts";
import { runPrismaCommand } from "./prisma.ts";
import { Runtime } from "../build/mod.ts";

export async function generateClient(
	project: Project,
	modules: Module[],
	runtime: Runtime,
	signal?: AbortSignal,
) {
	await forEachDatabase(
		project,
		modules,
		async ({ module, databaseUrl }) => {
			const dbDir = await runPrismaCommand(project, module, {
				args: ["generate"],
				env: {
					DATABASE_URL: databaseUrl,
					PRISMA_CLIENT_FORCE_WASM: "true",
				},
				interactive: false,
				output: false,
				signal,
			});
			const clientDir = resolve(dbDir, "client");

			// Specify the path to the library & binary types
			for (
				const filename of [
					"index.d.ts",
					"default.d.ts",
					"wasm.d.ts",
					"edge.d.ts",
				]
			) {
				const filePath = resolve(clientDir, filename);
				let content = await Deno.readTextFile(filePath);
				const replaceLineA = `import * as runtime from './runtime/library.js'`;
				const replaceLineB = `import * as runtime from './runtime/binary.js'`;
				content = content
					.replace(
						replaceLineA,
						`// @deno-types="./runtime/library.d.ts"\n${replaceLineA}`,
					)
					.replace(
						replaceLineB,
						`// @deno-types="./runtime/binary.d.ts"\n${replaceLineB}`,
					)
					.replace(/(import|export)\s+(.*)\s+from '.\/(default|index)'/g, `$1 type $2 from './$3.d.ts'`);
				await Deno.writeTextFile(filePath, content);
			}

			// Compile the ESM library
			await buildPrismaPackage(
				clientDir,
				resolve(clientDir, "esm.js"),
				runtime,
			);

			// Copy to module
			const dstDir = resolve(module.path, "_gen", "prisma");
			await emptyDir(dstDir);
			await copy(clientDir, dstDir, { overwrite: true });
		},
	);
}
