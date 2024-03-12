// Generates SQL migrations & generates client library.
//
// Wrapper around `prisma migrate dev`

import { Project } from "../project/mod.ts";
import { forEachPrismaSchema, runPrismaCommand } from "./mod.ts";

export async function migrateStatus(project: Project, signal?: AbortSignal) {
	await forEachPrismaSchema(project, [...project.modules.values()], async ({ databaseUrl }) => {
		// Get status
		await runPrismaCommand(project, {
			args: ["migrate", "status"],
			env: {
				DATABASE_URL: databaseUrl,
			},
			signal,
		});
	});
}
