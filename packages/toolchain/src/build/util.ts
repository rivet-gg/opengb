import { dirname, emptyDir, encoding, resolve } from "../deps.ts";
import { UnreachableError } from "../error/mod.ts";

/**
 * Extract a JSON archive built by the src/artifacts/* scripts.
 */
export async function inflateArchive(
	archive: Record<string, any>,
	outputPath: string,
	encode: "base64" | "string",
	signal?: AbortSignal,
) {
	signal?.throwIfAborted();

	await emptyDir(outputPath);

	for (const [file, value] of Object.entries(archive)) {
		signal?.throwIfAborted();

		const absPath = resolve(outputPath, file);
		await Deno.mkdir(dirname(absPath), { recursive: true });

		if (encode == "base64") {
			await Deno.writeFile(absPath, encoding.decodeBase64(value));
		} else if (encode == "string") {
			await Deno.writeTextFile(absPath, value);
		} else {
			throw new UnreachableError(encode);
		}
	}
}
