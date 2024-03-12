import { PostgresClient } from "./deps.ts";
import { Module, ModuleDatabase, Project } from "../project/mod.ts";
import { assertValidString } from "./validate.ts";
import { addShutdownHandler } from "../utils/shutdown_handler.ts";
import { verbose } from "../term/status.ts";
import { ensurePostgresRunning } from "../utils/postgres_daemon.ts";
import { createOnce, Once } from "../utils/once.ts";
import { getOrInitOnce } from "../utils/once.ts";

export const NODE_IMAGE = "node:21-alpine";
export const NODE_CONTAINER_NAME = "opengb-node";
export const PRISMA_VERSION = "5.9.1";

export type ForEachDatabaseCallback = (
	opts: { databaseUrl: string; module: Module; db: ModuleDatabase },
) => Promise<void>;
export type ForEachPrismaSchemaCallback = (
	opts: {
		databaseUrl: string;
		module: Module;
		db: ModuleDatabase;
		tempDir: string;
		generatedClientDir: string;
	},
) => Promise<void>;

interface DbState {
	defaultClientOnce: Once<PostgresClient>;
	createdDatabases: Set<string>;
}

function getDefaultDatabaseUrl(_project: Project) {
	return Deno.env.get("DATABASE_URL") ??
		"postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable";
}

async function getDefaultClient(project: Project) {
	return await getOrInitOnce(DB_STATE.defaultClientOnce, async () => {
		const client = new PostgresClient(getDefaultDatabaseUrl(project));
		await client.connect();

		addShutdownHandler(async () => {
			verbose("Shutting down default database client");
			await client.end();
		});

		return client;
	});
}

/**
 * State about the databases for the current process.
 */
const DB_STATE: DbState = {
	defaultClientOnce: createOnce(),
	createdDatabases: new Set(),
};

/** Prepares all databases and calls a callback once prepared. */
export async function forEachDatabase(
	project: Project,
	modules: Module[],
	callback: ForEachDatabaseCallback,
	signal?: AbortSignal,
) {
	signal?.throwIfAborted();

	await ensurePostgresRunning(project);

	// Setup database
	const defaultDatabaseUrl = Deno.env.get("DATABASE_URL") ??
		"postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable";

	const defaultClient = await getDefaultClient(project);

	for (const mod of modules) {
		if (!mod.db) continue;

		signal?.throwIfAborted();

		// Create database
		await createDatabase(defaultClient, mod.db);

		// Build URL
		const urlParsed = new URL(defaultDatabaseUrl);
		urlParsed.pathname = `/${mod.db.name}`;
		const databaseUrl = urlParsed.toString();

		// Callback
		await callback({ databaseUrl, module: mod, db: mod.db });
	}
}

/**
 * Create databases for a module.
 */
async function createDatabase(client: PostgresClient, db: ModuleDatabase) {
	// Check if already created
	if (DB_STATE.createdDatabases.has(db.name)) return;

	// Create database
	const existsQuery = await client.queryObject<
		{ exists: boolean }
	>`SELECT EXISTS (SELECT FROM pg_database WHERE datname = ${db.name})`;
	if (!existsQuery.rows[0].exists) {
		await client.queryObject(`CREATE DATABASE ${assertValidString(db.name)}`);
	}

	// Save as created
	DB_STATE.createdDatabases.add(db.name);
}
