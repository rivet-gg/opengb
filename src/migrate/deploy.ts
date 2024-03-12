// Deploys SQL migrations. See `dev.ts` to generate migrations.
//
// Wrapper around `prisma migrate deploy`

import { Module, Project } from "../project/mod.ts";
import { forEachDatabase } from "./mod.ts";
import { runPrismaCommand } from "./prisma.ts";

export async function migrateDeploy(project: Project, modules: Module[], signal?: AbortSignal) {
	await forEachDatabase(project, modules, async ({ databaseUrl, module }) => {
		await runPrismaCommand(project, module, {
			args: [
				"migrate",
				"deploy",
			],
			env: {
				DATABASE_URL: databaseUrl,
			},
			interactive: false,
			output: true,
			signal,
		});
	});
}
