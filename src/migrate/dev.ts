// Generates & deploys SQL migrations. See `deploy.ts` to only deploy migrations.
//
// Wrapper around `prisma migrate dev`

import { assert, copy, emptyDir, exists, resolve } from "../deps.ts";
import { Module, Project } from "../project/mod.ts";
import { verbose } from "../term/status.ts";
import { forEachDatabase } from "./mod.ts";
import { runPrismaCommand } from "./prisma.ts";

export interface MigrateDevOpts {
	createOnly: boolean;
	signal?: AbortSignal;
}

export async function migrateDev(
	project: Project,
	modules: Module[],
	opts: MigrateDevOpts,
	signal?: AbortSignal,
) {
	assert(
		modules.every((m) => !m.registry.isExternal),
		"Only modules from local registries can run migrateDev because it generates migration files",
	);

	await forEachDatabase(
		project,
		modules,
		async ({ databaseUrl, module }) => {
			const dbDir = await runPrismaCommand(project, module, {
				args: [
					"migrate",
					"dev",
					"--skip-generate",
					...(opts.createOnly ? ["--create-only"] : []),
				],
				env: {
					DATABASE_URL: databaseUrl,
				},
				interactive: true,
				output: true,
				signal,
			});

			// Copy back migrations dir
			//
			// Copy for both `path` (that we'll use later in this script) and
			// `sourcePath` (which is the original module's source)
			const tempMigrationsDir = resolve(dbDir, "migrations");
			assert(await exists(tempMigrationsDir, { isDirectory: true }), "Prisma did not generate migrations");

			const migrationsDir = resolve(module.path, "db", "migrations");
			verbose("Copying migrations", `${tempMigrationsDir} -> ${migrationsDir}`);
			await emptyDir(migrationsDir);
			await copy(tempMigrationsDir, migrationsDir, { overwrite: true });
		},
	);
}
