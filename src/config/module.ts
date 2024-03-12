import { parse, resolve } from "../deps.ts";
import { Ajv } from "./deps.ts";
import schema from "../../artifacts/module_schema.json" with { type: "json" };
import { InternalError } from "../error/mod.ts";

export interface ModuleConfig extends Record<string, unknown> {
	status?: "preview" | "beta" | "stable" | "deprecated";
	description?: string;

	/**
	 * The GitHub handle of the authors of the module.
	 */
	authors?: string[];

	scripts: { [name: string]: ScriptConfig };
	errors: { [name: string]: ErrorConfig };

	dependencies?: { [canonicalName: string]: DependencyConfig };
}

export interface ScriptConfig {
	/**
	 * If the script can be called from the public HTTP interface.
	 *
	 * If enabled, ensure that authentication & rate limits are configured for
	 * this endpoints. See the `user` and `rate_limit` modules.
	 *
	 * @default false
	 */
	public?: boolean;
}

export interface ErrorConfig {
	description?: string;
}

export interface DependencyConfig {
}

const moduleConfigAjv = new Ajv.default({
	schemas: [schema],
});

export async function readConfig(modulePath: string): Promise<ModuleConfig> {
	// Read config
	const configRaw = await Deno.readTextFile(
		resolve(modulePath, "module.yaml"),
	);
	const config = parse(configRaw) as ModuleConfig;

	// Validate config
	const moduleConfigSchema = moduleConfigAjv.getSchema(
		"#/definitions/ModuleConfig",
	);
	if (!moduleConfigSchema) {
		throw new InternalError("Failed to get module config schema");
	}
	if (!moduleConfigSchema(config)) {
		throw new InternalError(
			`Invalid module config: ${JSON.stringify(moduleConfigSchema.errors)}`,
		);
	}

	return config;
}

export function configPath(modulePath: string): string {
	return resolve(modulePath, "module.yaml");
}
