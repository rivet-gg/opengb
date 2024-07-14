import { resolve } from "../deps.ts";
import { UserError } from "../error/mod.ts";
import { z } from "../build/schema/deps.ts";

const ScriptConfigSchema = z.object({
	/**
	 * The human readable name of the script.
	 */
	name: z.string().optional().describe("The human readable name of the script."),

	/**
	 * A short description of the script.
	 */
	description: z.string().optional().describe("A short description of the script."),

	/**
	 * If the script can be called from the public HTTP interface.
	 *
	 * If enabled, ensure that authentication & rate limits are configured for
	 * this endpoints. See the `user` and `rate_limit` modules.
	 *
	 * @default false
	 */
	public: z.boolean().optional().default(false).describe(
		"If the script can be called from the public HTTP interface.",
	),
});

const ActorConfigSchema = z.object({
	/**
	 * Used to keep actor IDs the same in case the actor name changes.
	 *
	 * **IMPORTANT** Changing this will effectively unlink all data stored in
	 * this actor. Changing it back to the old value will restore the data.
	 */
	storageAlias: z.string().optional().describe(
		"Used to keep actor IDs the same in case the actor name changes.",
	),
});

const RouteConfigBaseSchema = z.object({
	name: z.string().optional().describe("The human readable name of the route."),
	description: z.string().optional().describe("A short description of the route."),
	method: z.string().optional().describe("The HTTP method of the route."),
});

const ExactRouteConfigSchema = RouteConfigBaseSchema.extend({
	path: z.string().describe("The path of the route."),
});

const DynamicRouteConfigSchema = RouteConfigBaseSchema.extend({
	pathPrefix: z.string().describe("The path prefix of the route."),
});

const RouteConfigSchema = z.union([
	ExactRouteConfigSchema,
	DynamicRouteConfigSchema,
]);

export type RouteConfigBase = z.infer<typeof RouteConfigBaseSchema>;

export type ExactRouteConfig = z.infer<typeof ExactRouteConfigSchema>;

export type DynamicRouteConfig = z.infer<typeof DynamicRouteConfigSchema>;

export type RouteConfig = z.infer<typeof RouteConfigSchema>;

const ErrorConfigSchema = z.object({
	/**
	 * The human readable name of the error.
	 */
	name: z.string().optional().describe("The human readable name of the error."),

	/**
	 * A short description of the error.
	 */
	description: z.string().optional().describe("A short description of the error."),
});

const DependencyConfigSchema = z.object({}).passthrough();

export const ModuleSchema = z.object({
	status: z.enum(["coming_soon", "preview", "beta", "stable", "maintenance", "end_of_life"]).optional().describe(
		"The status of the module.",
	),
	name: z.string().optional().describe("The human readable name of the module."),
	description: z.string().optional().describe("A short description of the module."),
	icon: z.string().optional().describe("The [Font Awesome](https://fontawesome.com/icons) icon name of the module."),
	tags: z.array(z.string()).optional().describe("The tags associated with this module."),
	authors: z.array(z.string()).optional().describe("The GitHub handle of the authors of the module."),
	scripts: z.record(ScriptConfigSchema).optional().describe("The scripts associated with this module."),
	actors: z.record(ActorConfigSchema).optional().describe("The actors associated with this module."),
	routes: z.record(RouteConfigSchema).optional().describe("The routes associated with this module."),
	errors: z.record(ErrorConfigSchema).describe("The errors associated with this module."),
	dependencies: z.record(DependencyConfigSchema).optional().describe("The dependencies of this module."),
	defaultConfig: z.unknown().optional().describe("Default user config."),
});

export type ModuleConfig = z.infer<typeof ModuleSchema>;

export type IndexedModuleConfig = Pick<
	z.infer<typeof ModuleSchema>,
	"name" | "icon" | "description" | "status" | "defaultConfig" | "dependencies" | "tags"
>;

export type ModuleStatus = Exclude<z.infer<typeof ModuleSchema>["status"], undefined>;

export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;

export type ActorConfig = z.infer<typeof ActorConfigSchema>;

export type ErrorConfig = z.infer<typeof ErrorConfigSchema>;

export type DependencyConfig = z.infer<typeof DependencyConfigSchema>;

export async function readConfig(modulePath: string): Promise<ModuleConfig> {
	// Read config
	const configPath = resolve(modulePath, "module.json");
	const configRaw = await Deno.readTextFile(configPath);
	let config = JSON.parse(configRaw) as ModuleConfig;

	// Validate config
	config = await ModuleSchema.parseAsync(config);

	// Validate unique actor storage ids
	const uniqueActorStorageIds = new Map();
	for (const [actorName, actor] of Object.entries(config.actors ?? {})) {
		const entry = uniqueActorStorageIds.get(actor.storageAlias);

		if (entry != undefined) {
			throw new UserError(
				`Duplicate storage IDs for actors "${entry}" and "${actorName}". Actor storage IDs must be unique.`,
			);
		} else {
			uniqueActorStorageIds.set(actor.storageAlias, actorName);
		}
	}

	return config;
}

export function configPath(modulePath: string): string {
	return resolve(modulePath, "module.json");
}
