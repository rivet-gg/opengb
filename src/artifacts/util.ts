import { resolve } from "../deps.ts";
import { UnreachableError } from "../error/mod.ts";
import { glob } from "./deps.ts";

/**
 * Path to the root of the repo. Used for reading & writing files to the
 * project.
 */
export function rootSrcPath() {
	const dirname = import.meta.dirname;
	if (!dirname) throw new Error("Missing dirname");

	return resolve(dirname, "..", "..");
}

/**
 * @param files Files to include in the archive. Usually generated using glob.
 * @param outputPath JSON file to write the archive to.
 */
export async function buildArtifacts(
	{ rootPath, patterns, outputPath, globOpts, encode }: {
		rootPath: string;
		patterns: string[];
		outputPath: string;
		globOpts?: any;
		encode?: "base64" | "string";
	},
) {
	encode = encode ?? "base64";

	// Glob files
	const files = await glob.glob(patterns, {
		cwd: rootPath,
		nodir: true,
		...globOpts,
	});
	files.sort();

	// Build object
	//
	// Do this manually instead of with JSON.stringify in order to ensure there's
	// one entry per line in alphabetical order for more useful Git diffs.
	const archiveFileSizes: Record<string, number> = {};
	let archiveFile = "{\n";
	for (let i = 0; i < files.length; i++) {
		const file = files[i];

		// Get file contents
		let content: string;
		if (encode == "base64") {
			const data = await Deno.readFile(resolve(rootPath, file));
			content = btoa(new Uint8Array(data).reduce((acc, byte) => acc + String.fromCharCode(byte), ""));
		} else if (encode == "string") {
			content = await Deno.readTextFile(resolve(rootPath, file));
		} else {
			throw new UnreachableError(encode);
		}

		// Add to JSON
		archiveFile += `${JSON.stringify(file)}:${JSON.stringify(content)}`;
		if (i != files.length - 1) archiveFile += ",\n";
		else archiveFile += "\n";

		archiveFileSizes[file] = content.length;
	}
	archiveFile += "}";

	// Write schema to file
	await Deno.writeTextFile(
		outputPath,
		archiveFile,
	);

	// Print largest files. File sizes are in encoded format.
	console.log("Largest files:");
	Object.keys(archiveFileSizes)
		.sort((a, b) => archiveFileSizes[b] - archiveFileSizes[a]).slice(0, 10)
		.forEach((key) => console.log(key, Math.ceil(archiveFileSizes[key] / 1000) + "KB"));
}
