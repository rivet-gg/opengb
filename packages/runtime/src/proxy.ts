import { ActorContext, Context, ModuleContext, Runtime, Trace } from "./mod.ts";
import { RequestOf, ResponseOf } from "./types/registry.ts";
import { ActorProxy } from "./actor/proxy.ts";
import { ContextParams } from "./context.ts";

type ModuleRegistryPair = readonly [string, string];

/**
 * This type is used denote a map the key/value pairs of one registry to
 * another.
 *
 * Example:
 * ```ts
 * type TestReg1 = {
 *   foo: {
 *     bar: { request: FooBarRequest, response: FooBarResponse },
 *     baz: { request: FooBazRequest, response: FooBazResponse },
 *   },
 *   fil: {
 *     qux: { request: FilQuxRequest, response: FilQuxResponse },
 *     cor: { request: FilCorRequest, response: FilCorResponse },
 *   }
 * };
 *
 * type TestReg2 = {
 *   canonicalFoo: {
 *     bar: { request: FooBarRequest, response: FooBarResponse },
 *     bazScript: { request: FooBazRequest, response: FooBazResponse },
 *   },
 *   filMod: {
 *     qux: { request: FilQuxRequest, response: FilQuxResponse },
 *     cor: { request: FilCorRequest, response: FilCorResponse },
 *   },
 * };
 *
 * const map: RegistryCallMap<TestReg1, TestReg2> = {
 *   foo: {
 *     bar: ["canonicalFoo", "bar"],
 *     baz: ["canonicalFoo", "bazScript"],
 *   },
 *   fil: {
 *     qux: ["filMod", "qux"],
 *     cor: ["filMod", "cor"],
 *   },
 * };
 * ```
 *
 * This is used by the {@linkcode buildDependencyRegistryProxy} function to map the camel
 * case keys from `ctx.modules.<camelMod>.<camelScript>(data);` to an
 * equivalent call to `ctx.call(<snake_mod>, <snake_script>, data);`.
 */
export type RegistryCallMap = Record<string, ModuleCallMap>;

export type ModuleCallMap = Record<string, ModuleRegistryPair>;

/**
 * A callable registry is an object that describes the structure of
 * `ctx.modules`.
 *
 * If we have a registry like this:
 * - module `foo`
 *   - script `bar`
 *     - request type `BarRequest`
 *     - response type `BarResponse`
 *   - script `baz`
 *     - request type `BazRequest`
 *     - response type `BazResponse`
 * - module `fil`
 *   - script `qux`
 *     - request type `QuxRequest`
 *     - response type `QuxResponse`
 *   - script `cor`
 *     - request type `CorRequest`
 *     - response type `CorResponse`
 *
 * The callable registry would look like this:
 * ```ts
 * type CallableRegistry_TestReg = {
 *   foo: {
 *     bar: (req: BarRequest) => Promise<BarResponse>,
 *     baz: (req: BazRequest) => Promise<BazResponse>,
 *   },
 *   fil: {
 *     qux: (req: QuxRequest) => Promise<QuxResponse>,
 *     cor: (req: CorRequest) => Promise<CorResponse>,
 *   },
 * }
 * ```
 *
 * This is the type returned by the {@linkcode buildDependencyRegistryProxy} function.
 *
 * It is accessible to the user as `ctx.modules`.
 */
export type CallableDependencies<DependenciesT> = {
	[Mod in keyof DependenciesT]: {
		[Script in keyof DependenciesT[Mod]]: (
			req: RequestOf<DependenciesT[Mod][Script]>,
		) => Promise<ResponseOf<DependenciesT[Mod][Script]>>;
	};
};

/**
 * TODO: Comment
 */
export type ActorProxies<ActorsT> = {
	[Actor in keyof ActorsT]: ActorProxy;
};

/**
 * @param ctx The {@link Context} object to use to call the scripts in
 * accessible modules
 * @param map A {@link MapFrom} object that describes how to map
 * `[module, script] pairs from a camelCase registry to a snake_case registry
 * @returns A {@link CallableDependencies} object that implements the "syntax sugar"
 * that used in the `ctx.modules.<script>.<name>()` pattern to call scripts
 * without the `ctx.call` function.
 */
export function buildDependencyRegistryProxy<Params extends ContextParams>(
	ctx: Context<Params>,
	dependenciesMapCamelToSnake: RegistryCallMap,
): CallableDependencies<Params["dependenciesCamel"]> {
	const handler = {
		get: (_target: unknown, camelCaseModuleKey: string) => {
			if (camelCaseModuleKey in dependenciesMapCamelToSnake) {
				const camelToSnakeMapForModule = dependenciesMapCamelToSnake[camelCaseModuleKey]!;

				return new Proxy(camelToSnakeMapForModule, {
					get: (_target: unknown, scriptProp: string) => {
						if (scriptProp in camelToSnakeMapForModule) {
							const [snakeCaseModule, snakeCaseScript] = camelToSnakeMapForModule[scriptProp]!;
							return (req: unknown) => {
								return ctx.call(
									snakeCaseModule as any,
									snakeCaseScript as any,
									req as any,
								);
							};
						} else {
							return undefined;
						}
					},
				});
			} else {
				return undefined;
			}
		},
	};
	return new Proxy({}, handler) as CallableDependencies<Params["dependenciesCamel"]>;
}

export function buildActorRegistryProxy<ActorsSnakeT, ActorsCamelT>(
	runtime: Runtime<any>,
	actorMap: ModuleCallMap,
	trace: Trace,
): ActorProxies<ActorsCamelT> {
	return new Proxy(actorMap, {
		get: (_target: unknown, actorProp: string) => {
			if (actorProp in actorMap) {
				const [moduleName, actorName] = actorMap[actorProp as keyof typeof actorMap]!;

				return new ActorProxy(
					runtime,
					runtime.actorDriver,
					moduleName,
					actorName,
					trace,
				);
			} else {
				return undefined;
			}
		},
	}) as ActorProxies<ActorsCamelT>;
}
