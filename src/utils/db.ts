const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable";

export function isExternalDatabase(): boolean {
	return typeof Deno.env.get("DATABASE_URL") === "string";
}

export function getDatabaseUrl(dbName: string): URL {
	const moduleDbUrl = Deno.env.get(`DATABASE_URL_${dbName}`);

	let url;
	if (moduleDbUrl) {
		url = new URL(moduleDbUrl);
	} else {
		// Build URL for this database
		url = new URL(getDefaultDatabaseUrl());
		url.pathname = "/" + dbName;
	}

	return url;
}

export function getDefaultDatabaseUrl(): string {
	return Deno.env.get("DATABASE_URL") ?? DEFAULT_DATABASE_URL;
}
