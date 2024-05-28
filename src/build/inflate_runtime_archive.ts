import runtimeArchive from "../../artifacts/runtime_archive.json" with { type: "json" };
import { dirname, emptyDir, resolve } from "../deps.ts";
import { Project } from "../project/mod.ts";
import { genPath, RUNTIME_PATH } from "../project/project.ts";

/**
 * Writes a copy of the OpenGB runtime bundled with the CLI to the project.
 */
export async function inflateRuntimeArchive(project: Project, signal?: AbortSignal) {
	signal?.throwIfAborted();

	const inflateRuntimePath = genPath(project, RUNTIME_PATH);

	await emptyDir(inflateRuntimePath);

	for (const [file, value] of Object.entries(runtimeArchive)) {
		signal?.throwIfAborted();

		const absPath = resolve(inflateRuntimePath, file);
		await Deno.mkdir(dirname(absPath), { recursive: true });
		await Deno.writeTextFile(absPath, value);
	}
}
