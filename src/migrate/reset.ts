// Generates SQL migrations & generates client library.
//
// Wrapper around `prisma migrate dev`

import { Project } from "../project/mod.ts";
import { forEachDatabase } from "./mod.ts";
import { runPrismaCommand } from "./prisma.ts";

export async function migrateReset(project: Project, signal?: AbortSignal) {
	await forEachDatabase(project, [...project.modules.values()], async ({ databaseUrl, module }) => {
		await runPrismaCommand(project, module, {
			args: ["migrate", "reset", "--skip-generate"],
			env: {
				DATABASE_URL: databaseUrl,
			},
			interactive: true,
			output: true,
			signal,
		});
	});
}
