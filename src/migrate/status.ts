// Generates SQL migrations & generates client library.
//
// Wrapper around `prisma migrate dev`

import { Project } from "../project/mod.ts";
import { forEachDatabase } from "./mod.ts";
import { runPrismaCommand } from "./prisma.ts";

export async function migrateStatus(project: Project, signal?: AbortSignal) {
	await forEachDatabase(project, [...project.modules.values()], async ({ databaseUrl, module }) => {
		// Get status
		await runPrismaCommand(project, module, {
			args: ["migrate", "status"],
			env: {
				DATABASE_URL: databaseUrl,
			},
			interactive: false,
			output: true,
			signal,
		});
	});
}
