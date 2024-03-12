// Deploys SQL migrations. See `dev.ts` to generate migrations.
//
// Wrapper around `prisma migrate deploy`

import { Module, Project } from "../project/mod.ts";
import { forEachPrismaSchema, runPrismaCommand } from "./mod.ts";

export async function migrateDeploy(project: Project, modules: Module[], signal?: AbortSignal) {
	await forEachPrismaSchema(project, modules, async ({ databaseUrl }) => {
		await runPrismaCommand(project, {
			args: [
				"migrate",
				"deploy",
			],
			env: {
				DATABASE_URL: databaseUrl,
			},
			signal,
		});
	});
}
