import { parse, resolve } from "../deps.ts";
import { Ajv } from "./deps.ts";
import schema from "../../artifacts/module_schema.json" with { type: "json" };
import { InternalError, UserError } from "../error/mod.ts";

export interface ModuleConfig extends Record<string, unknown> {
	status?: "preview" | "beta" | "stable" | "maintenance" | "end_of_life";

	/**
	 * The human readable name of the module.
	 */
	name?: string;

	/**
	 * A short description of the module.
	 */
	description?: string;

	/**
	 * The [Font Awesome](https://fontawesome.com/icons) icon name of the module.
	 */
	icon?: string;

	/**
	 * The tags associated with this module.
	 */
	tags?: string[];

	/**
	 * The GitHub handle of the authors of the module.
	 */
	authors?: string[];

	scripts: { [name: string]: ScriptConfig };
	actors?: { [name: string]: ActorConfig };
	errors: { [name: string]: ErrorConfig };

	dependencies?: { [canonicalName: string]: DependencyConfig };
}

export type ModuleStatus = "preview" | "beta" | "stable" | "deprecated";

export interface ScriptConfig {
	/**
	 * The human readable name of the script.
	 */
	name?: string;

	/**
	 * A short description of the script.
	 */
	description?: string;

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

export interface ActorConfig {
	/**
	 * A globally unique string for storing data for this actor.
	 *
	 * **IMPORTANT** Changing this will effectively unlink all data stored in this actor. Changing it back to
	 * the old value will restore the data.
	 */
	storage_id: string;
}

export interface ErrorConfig {
	/**
	 * The human readable name of the error.
	 */
	name?: string;

	/**
	 * A short description of the error.
	 */
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
	const moduleConfigSchema = moduleConfigAjv.getSchema("#");
	if (!moduleConfigSchema) {
		throw new InternalError("Failed to get module config schema");
	}
	if (!moduleConfigSchema(config)) {
		throw new InternalError(
			`Invalid module config: ${JSON.stringify(moduleConfigSchema.errors)}`,
		);
	}

	// Validate unique actor storage ids
	const uniqueActorStorageIds = new Map();
	for (const [actorName, actor] of Object.entries(config.actors ?? {})) {
		const entry = uniqueActorStorageIds.get(actor.storage_id);

		if (entry != undefined) {
			throw new UserError(
				`Duplicate storage IDs for actors "${entry}" and "${actorName}". Actor storage IDs must be unique.`,
			);
		} else {
			uniqueActorStorageIds.set(actor.storage_id, actorName);
		}
	}

	return config;
}

export function configPath(modulePath: string): string {
	return resolve(modulePath, "module.yaml");
}
