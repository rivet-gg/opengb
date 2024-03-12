import { exists, resolve, tjs } from "../deps.ts";
import { UnreachableError } from "../error/mod.ts";
import { Project } from "../project/project.ts";
import { verbose } from "../term/status.ts";
import { crypto, encodeHex } from "./deps.ts";

// TODO: Replace this with the OpenGB version instead since it means we'll change . We need to compile this in the build artifacts.
export const CACHE_VERSION = 5;

export interface Cache {
	persist: CachePersist;

	/**
	 * Expressions that have been compared in this process.
	 */
	hashDiffs: Map<string, boolean>;
}

/** Cache data that gets persisted to disk. */
export interface CachePersist {
	version: number;
	hashes: Record<string, string>;
	moduleConfigSchemas: Record<string, tjs.Definition>;
	scriptSchemas: Record<
		string,
		Record<string, { request: tjs.Definition; response: tjs.Definition }>
	>;
}

export interface CacheScriptSchema {
	request: tjs.Definition;
	response: tjs.Definition;
}

export async function loadCache(project: Project): Promise<Cache> {
	const buildCachePath = resolve(project.path, "_gen", "cache.json");

	// Read hashes from file
	let persist: CachePersist;
	if (await exists(buildCachePath)) {
		try {
			const oldCacheAny: any = JSON.parse(
				await Deno.readTextFile(buildCachePath),
			);

			// Validate version
			if (oldCacheAny.version == CACHE_VERSION) {
				persist = oldCacheAny;
			} else {
				persist = createEmptyCachePersist();
			}
		} catch {
			// If parsing fails or the cache isn't readable, reset the cache.
			persist = createEmptyCachePersist();
		}
	} else {
		persist = createEmptyCachePersist();
	}

	return {
		persist,
		hashDiffs: new Map(),
	};
}

export async function writeCache(project: Project, cache: Cache) {
	const buildCachePath = resolve(project.path, "_gen", "cache.json");

	// Write cache
	await Deno.writeTextFile(
		buildCachePath,
		JSON.stringify(cache.persist),
	);
}

function createEmptyCachePersist(): CachePersist {
	return {
		version: CACHE_VERSION,
		hashes: {},
		moduleConfigSchemas: {},
		scriptSchemas: {},
	};
}

/**
 * Checks if the hash of a file has changed. Returns true if file changed.
 */
export async function compareFileHash(
	cache: Cache,
	stepId: string,
	paths: string[],
): Promise<boolean> {
	const files: Record<string, HashValue> = {};
	await Promise.all(
		paths.map(async (path) => {
			const key = `file:${path}`;
			if (await exists(path, { isFile: true })) {
				files[key] = await Deno.open(path, { read: true });
			} else {
				files[key] = null;
			}
		}),
	);

	return await compareHash(cache, stepId, files);
}

export type HashValue = Deno.FsFile | string | number | boolean | null;

/**
 * Checks if the hash of an expression has changed. Returns true if expression changed.
 */
export async function compareHash(
	cache: Cache,
	stepId: string,
	values: Record<string, HashValue>,
): Promise<boolean> {
	// We hash all values regardless of if we already know there was a change so
	// we can re-use these hashes on the next run to see if anything changed.
	// Otherwise, this would return a false positive for future runs if multiple
	// files were changed in one run.
	let hasChanged = false;
	for (const [localName, value] of Object.entries(values)) {
		const name = `${stepId}:${localName}`;

		// Check if already diffed this process
		const diff = cache.hashDiffs.get(name);
		if (diff !== undefined) {
			if (diff) hasChanged = true;
			continue;
		}

		// Compare hash
		let valueChanged = false;
		const oldHash = cache.persist.hashes[name];
		const newHash = await hashValue(cache, name, value);
		if (newHash != oldHash) {
			valueChanged = true;

			verbose("Changed", name);
		}
		if (valueChanged) hasChanged = true;

		// Cache diff so we don't have to rehash the expr
		cache.hashDiffs.set(name, valueChanged);
	}

	return hasChanged;
}

export async function hashValue(
	cache: Cache,
	name: string,
	value: HashValue,
): Promise<string> {
	if (value === null) return "null";

	// Calculate hash
	let hash;
	if (value === null) {
		hash = "null";
	} else {
		let digest;
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			digest = await crypto.subtle.digest(
				"SHA-256",
				await new Blob([value.toString()]).arrayBuffer(),
			);
		} else if (value instanceof Deno.FsFile) {
			digest = await crypto.subtle.digest(
				"SHA-256",
				value.readable,
			);
		} else {
			throw new UnreachableError(value);
		}
		hash = encodeHex(digest);
	}

	cache.persist.hashes[name] = hash;

	return hash;
}
