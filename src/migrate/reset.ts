// Generates SQL migrations & generates client library.
//
// Wrapper around `prisma migrate dev`

import { Project } from "../project/mod.ts";
import { forEachPrismaSchema, runPrismaCommand } from "./mod.ts";

export async function migrateReset(project: Project, signal?: AbortSignal) {
	await forEachPrismaSchema(project, [...project.modules.values()], async ({ databaseUrl }) => {
		// Generate migrations & client
		await runPrismaCommand(project, {
			args: ["migrate", "reset", "--skip-generate"],
			env: {
				DATABASE_URL: databaseUrl,
			},
			signal,
		});
	});
}
