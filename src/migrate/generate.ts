// Generates Prisma client libraries.
//
// Wrapper around `prisma generate`

import { copy, emptyDir, resolve } from "../deps.ts";
import { buildPrismaPackage } from "./build_prisma_esm.ts";
import { Module, Project } from "../project/mod.ts";
import { forEachPrismaSchema, runPrismaCommand } from "./mod.ts";
import { Runtime } from "../build/mod.ts";

export async function generateClient(
	project: Project,
	modules: Module[],
	runtime: Runtime,
) {
	await forEachPrismaSchema(
		project,
		modules,
		async ({ module, databaseUrl, generatedClientDir }) => {
			// Clear generated dir
			await emptyDir(generatedClientDir);

			// Generate client
			await runPrismaCommand(project, {
				args: ["generate"],
				env: {
					DATABASE_URL: databaseUrl,
					PRISMA_CLIENT_FORCE_WASM: "true",
				},
			});

			// Specify the path to the library & binary types
			for (
				const filename of [
					"index.d.ts",
					"default.d.ts",
					"wasm.d.ts",
					"edge.d.ts",
				]
			) {
				const filePath = resolve(generatedClientDir, filename);
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
					.replace(/from '.\/default'/g, `from './default.d.ts'`);
				await Deno.writeTextFile(filePath, content);
			}

			// Compile the ESM library
			await buildPrismaPackage(
				generatedClientDir,
				resolve(generatedClientDir, "esm.js"),
				runtime,
			);

			// Copy to module
			const dstDir = resolve(module.path, "_gen", "prisma");
			await emptyDir(dstDir);
			await copy(generatedClientDir, dstDir, { overwrite: true });

			// HACK: Remove the generated client dir to work around a bug in the Prisma CLI
			await emptyDir(generatedClientDir);
		},
	);
}
