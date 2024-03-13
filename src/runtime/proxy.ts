import { Context } from "../runtime/mod.ts";
import { RequestOf, ResponseOf } from "../types/registry.ts";

/**
 * A type that represents the names of the scripts in a specific module in a registry.
 */
type ScriptNamesForModule<RegistryT, Key extends keyof RegistryT> = keyof RegistryT[Key];

/**
 * A type that represents the module-script pairs in a registry.
 */
type AllModuleScriptPairs<RegistryT> = {
	[Key in keyof RegistryT]: Readonly<{
		module: Key;
		script: ScriptNamesForModule<RegistryT, Key>;
	}>;
}[keyof RegistryT];

/**
 * An mapping from module-script pairs in ProxyRegistry to module-script pairs
 * in LookupRegistry.
 *
 * Example:
 * ```ts
 * interface ProxyRegistry {
 *     fooModule: {
 *         bazScript: { ... };
 *         quxScript: { ... };
 *     };
 *     barModule: {
 *         bazScript: { ... };
 *         bonScript: { ... };
 *     };
 * };
 *
 * interface LookupTarget {
 *     foo_module: {
 *         baz_script: { ... };
 *         qux_script: { ... };
 *     };
 *     bar_module: {
 *         baz_script: { ... };
 *         bon_script: { ... };
 *     };
 * };
 *
 * const lookup: RegistryCrossLookup<ProxyRegistry, LookupTarget> = {
 *     fooModule: {
 *         bazScript: { module: "foo_module", script: "baz_script" },
 *         quxScript: { module: "foo_module", script: "qux_script" },
 *     },
 *     barModule: {
 *         bazScript: { module: "bar_module", script: "baz_script" },
 *         bonScript: { module: "bar_module", script: "bon_script" },
 *     },
 * };
 * ```
 */
export type RegistryPathLookup<ProxyRegistry, LookupTarget> = {
	[Mod in keyof ProxyRegistry]: {
		[Script in keyof ProxyRegistry[Mod]]: AllModuleScriptPairs<LookupTarget>;
	};
};

/**
 * Transforms all of the
 * `{ request: Req, response: Res }`
 * pairs at the leaves of the registry into
 * `(req: Req) => Promise<Res>`
 * functions.
 */
export type CallableRegistry<RegistryT> = {
	[Mod in keyof RegistryT]: {
		[Script in keyof RegistryT[Mod]]: (
			req: RequestOf<RegistryT[Mod][Script]>,
		) => Promise<ResponseOf<RegistryT[Mod][Script]>>;
	};
};

/**
 * This function takes a context and a mapping and essentially makes a function
 * call like this: `ctx.call(<module_name>, <script_name>, <req>)` look like this:
 * `obj.<moduleName>.<scriptName>(<req>)`.
 *
 * @param ctx The context on which to call `ctx.call(...).
 * @param map The mapping from camelCase module/script names to snake_case
 * module/script names.
 * @returns A proxy that transforms `obj.<moduleName>.<scriptName>(<req>)` into
 * `ctx.call(<module_name>, <script_name>, <req>)`.
 */
export function buildRegistryProxy<RegistryT, RegistryCamelT>(
	ctx: Context<RegistryT, RegistryCamelT>,
	map: RegistryPathLookup<RegistryCamelT, RegistryT>,
): CallableRegistry<RegistryCamelT> {
	const handler = {
		get: (_target: unknown, moduleProp: string) => {
			if (moduleProp in map) {
				const moduleMap = map[moduleProp as keyof typeof map];

				return new Proxy(moduleMap, {
					get: (_target: unknown, scriptProp: string) => {
						if (scriptProp in moduleMap) {
							const pair = moduleMap[scriptProp as keyof typeof moduleMap];
							return (req: unknown) => {
								return ctx.call(
									pair.module as any,
									pair.script as any,
									req as any,
								);
							};
						}
					},
				});
			}
		},
	};
	return new Proxy({}, handler) as CallableRegistry<RegistryCamelT>;
}
