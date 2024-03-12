import { exists, resolve, tjs } from "../deps.ts";
import { Project } from "../project/project.ts";
import { verbose } from "../term/status.ts";
import { crypto, encodeHex } from "./deps.ts";

// TODO: Replace this with the OpenGB version instead since it means we'll change . We need to compile this in the build artifacts.
export const CACHE_VERSION = 4;

export interface Cache {
	persist: CachePersist;

	/**
	 * Files that have been compared in this process.
	 */
	fileDiffs: Map<string, boolean>;

	/**
	 * Expressions that have been compared in this process.
	 */
	exprDiffs: Map<string, boolean>;
}

/** Cache data that gets persisted to disk. */
export interface CachePersist {
	version: number;
	fileHashes: Record<string, FileHash>;
	exprHashes: Record<string, string>;
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

export type FileHash = { hash: string } | { missing: true };

export async function loadCache(project: Project): Promise<Cache> {
	const buildCachePath = resolve(project.path, "_gen", "cache.json");

	// Read hashes from file
	let persist: CachePersist;
	if (await exists(buildCachePath)) {
		try {
			// Try to parse the old cache
			const oldCacheAny: any = JSON.parse(await Deno.readTextFile(buildCachePath));

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
		fileDiffs: new Map(),
		exprDiffs: new Map(),
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
		fileHashes: {},
		exprHashes: {},
		moduleConfigSchemas: {},
		scriptSchemas: {},
	};
}

/**
 * Checks if the hash of a file has changed. Returns true if file changed.
 */
export async function compareFileHash(
	cache: Cache,
	paths: string[],
): Promise<boolean> {
	// We hash all files regardless of if we already know there was a change so
	// we can re-use these hashes on the next run to see if anything changed.
	// Otherwise, this would return a false positive for future runs if multiple
	// files were changed in one run.
	let hasChanged = false;
	for (const path of paths) {
		// Check if already diffed this process
		const diff = cache.fileDiffs.get(path);
		if (diff !== undefined) {
			if (diff) hasChanged = true;
			continue;
		}

		// Compre hash
		const oldHash = cache.persist.fileHashes[path];
		const newHash = await hashFile(cache, path);
		if (!oldHash) {
			hasChanged = true;
			verbose("Created", path);
		} else if ("missing" in oldHash && "missing" in newHash) {
			// Do nothing
		} else if ("hash" in oldHash && "hash" in newHash) {
			if (oldHash.hash != newHash.hash) {
				hasChanged = true;
				verbose("Edited", path);
			}
		} else {
			hasChanged = true;
			if ("missing" in oldHash) verbose("Created", path);
			else verbose("Removed", path);
		}

		// Cache diff so we don't have to rehash the file
		cache.fileDiffs.set(path, hasChanged);
	}

	return hasChanged;
}

export async function hashFile(
	cache: Cache,
	path: string,
): Promise<FileHash> {
	let hash: FileHash;
	if (await exists(path)) {
		// Calculate hash
		const file = await Deno.open(path, { read: true });
		const fileHashBuffer = await crypto.subtle.digest(
			"SHA-256",
			file.readable,
		);
		hash = { hash: encodeHex(fileHashBuffer) };
	} else {
		// Specify missing
		hash = { missing: true };
	}

	cache.persist.fileHashes[path] = hash;

	return hash;
}

/**
 * Checks if the hash of an expression has changed. Returns true if expression changed.
 */
export async function compareExprHash(
	cache: Cache,
	exprs: Record<string, string>,
): Promise<boolean> {
	// We hash all files regardless of if we already know there was a change so
	// we can re-use these hashes on the next run to see if anything changed.
	// Otherwise, this would return a false positive for future runs if multiple
	// files were changed in one run.
	let hasChanged = false;
	for (const [name, value] of Object.entries(exprs)) {
		// Check if already diffed this process
		const diff = cache.exprDiffs.get(name);
		if (diff !== undefined) {
			if (diff) hasChanged = true;
			continue;
		}

		// Compare hash
		const oldHash = cache.persist.exprHashes[name];
		const newHash = await hashExpr(cache, name, value);
		if (newHash != oldHash) {
			hasChanged = true;

			verbose("Changed", name);
		}

		// Cache diff so we don't have to rehash the expr
		cache.exprDiffs.set(name, hasChanged);
	}

	return hasChanged;
}

export async function hashExpr(
	cache: Cache,
	name: string,
	value: any,
): Promise<string> {
	// Calculate hash
	const exprHashBuffer = await crypto.subtle.digest(
		"SHA-256",
		await new Blob([value]).arrayBuffer(),
	);
	const hash = encodeHex(exprHashBuffer);
	cache.persist.exprHashes[name] = hash;

	return hash;
}
