// deno task artifacts:build:runtime_archive
//
// Generates a JSON file with all of the runtime's source that can be used to re-populate the source

import { resolve } from "../deps.ts";
import { glob } from "./deps.ts";

const dirname = import.meta.dirname;
if (!dirname) throw new Error("Missing dirname");

const rootSrc = resolve(dirname, "..", "..");

const files = await glob.glob([
	"src/{runtime,types,dynamic}/*.ts",
	"src/deps.ts",
	"src/utils/db.ts",
], { cwd: rootSrc });

const archiveFiles: Record<string, string> = {};
for (const file of files) {
	archiveFiles[file] = await Deno.readTextFile(resolve(rootSrc, file));
}

// Create artifacts folder if it doesn't already exist
await Deno.mkdir(resolve(rootSrc, "artifacts"), { recursive: true });

// Write schema to file
await Deno.writeTextFile(
	resolve(rootSrc, "artifacts", "runtime_archive.json"),
	JSON.stringify(archiveFiles),
);
