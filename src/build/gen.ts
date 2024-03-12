import { dedent } from "./deps.ts";
import { dirname, relative, resolve } from "../deps.ts";
import { Module, moduleGenPath, Project, Script, scriptGenPath, testGenPath, typeGenPath } from "../project/mod.ts";
import { genRuntimeModPath } from "../project/project.ts";
import { autoGenHeader } from "./misc.ts";
import { camelify, pascalify } from "../types/case_conversions.ts";
import { genRegistryMapPath } from "../project/project.ts";
import { hasUserConfigSchema } from "../project/module.ts";

export async function compileModuleHelper(
	project: Project,
	module: Module,
) {
	const helperPath = moduleGenPath(project, module);
	const runtimePath = relative(dirname(helperPath), genRuntimeModPath(project));

	// Generate source
	let dbImports = "";
	if (module.db) {
		dbImports = dedent`
			import prisma from "./prisma/esm.js";
			export { prisma };
			export const Prisma = prisma.Prisma;
		`;
	}

	const { userConfigImport, userConfigType } = await getUserConfigImport(module, "..");

	const source = dedent`
		import { ModuleContext as ModuleContextInner } from "${runtimePath}";
		import type { Registry as RegistryTypeInner, RegistryCamel as RegistryCamelTypeInner } from "./registry.d.ts";
		${dbImports}
		${userConfigImport}
		
		/**
		 * Empty Request/Response type.
		 * 
		 * This only exists because of some quirks of empty interfaces in
		 * typescript that can be read more about here:
		 * https://www.totaltypescript.com/the-empty-object-type-in-typescript
		 */
		export type Empty = Record<string, never>;
		export { RuntimeError } from "${runtimePath}";
		export type ModuleContext = ModuleContextInner<
			RegistryTypeInner,
			RegistryCamelTypeInner,
			${userConfigType},
			${module.db ? "prisma.PrismaClient" : "undefined"}
		>;
	`;

	// Write source
	await Deno.mkdir(dirname(helperPath), { recursive: true });
	await Deno.writeTextFile(helperPath, source);
}

export async function compileTestHelper(
	project: Project,
	module: Module,
) {
	const helperPath = testGenPath(project, module);
	const runtimePath = relative(dirname(helperPath), genRuntimeModPath(project));
	const registryMapPath = relative(dirname(helperPath), genRegistryMapPath(project));
	const runtimeConfigPath = relative(dirname(helperPath), `${project.path}/_gen/runtime_config.ts`);

	const { userConfigImport, userConfigType } = await getUserConfigImport(module, "..");

	const source = dedent`
		${autoGenHeader()}
		import * as module from "./mod.ts";
		import { Runtime, TestContext as TestContextInner } from "${runtimePath}";
		import type { Registry as RegistryTypeInner, RegistryCamel as RegistryCamelTypeInner } from "./registry.d.ts";
		import { camelToSnake } from "${registryMapPath}";
		import config from "${runtimeConfigPath}";
		${userConfigImport}
		
		export * from "./mod.ts";
		
		export type TestContext = TestContextInner<
			RegistryTypeInner,
			RegistryCamelTypeInner,
			${userConfigType},
			${module.db ? "module.prisma.PrismaClient" : "undefined"}
		>;
		
		export type TestFn = (ctx: TestContext) => Promise<void>;
		
		export function test(name: string, fn: TestFn) {
			Runtime.test(config, "${module.name}", name, fn, camelToSnake);
		}
	`;

	// Write source
	await Deno.mkdir(dirname(helperPath), { recursive: true });
	await Deno.writeTextFile(helperPath, source);
}

export async function compileScriptHelper(
	project: Project,
	module: Module,
	script: Script,
) {
	const helperPath = scriptGenPath(project, module, script);
	const runtimePath = relative(dirname(helperPath), genRuntimeModPath(project));

	const { userConfigImport, userConfigType } = await getUserConfigImport(module, "../..");

	const source = dedent`
		${autoGenHeader()}
		import * as module from "../mod.ts";
		import { ScriptContext as ScriptContextInner } from "${runtimePath}";
		import type { Registry as RegistryTypeInner, RegistryCamel as RegistryCamelTypeInner } from "../registry.d.ts";
		${userConfigImport}

		export * from "../mod.ts";

		export type ScriptContext = ScriptContextInner<
			RegistryTypeInner,
			RegistryCamelTypeInner,
			${userConfigType},
			${module.db ? "module.prisma.PrismaClient" : "undefined"}
		>;
	`;

	// Write source
	await Deno.mkdir(dirname(helperPath), { recursive: true });
	await Deno.writeTextFile(helperPath, source);
}

export async function compileTypeHelpers(project: Project) {
	const typedefPath = resolve(
		project.path,
		"_gen",
		"registry.d.ts",
	);
	const typemapPath = resolve(
		project.path,
		"_gen",
		"registryMap.ts",
	);

	let moduleTypesSource = "";
	let moduleSnakeRegistrySource = "";
	let moduleCamelRegistrySource = "";
	let registryMapSource = "";
	for (const module of project.modules.values()) {
		const moduleNameSnake = module.name;
		const moduleNameCamel = camelify(module.name);
		const moduleNamePascal = pascalify(module.name);

		let scriptImportsSource = "";
		let scriptSnakeInterfaceSource = "";
		let scriptCamelInterfaceSource = "";
		let moduleRegistryMap = "";
		for (const script of module.scripts.values()) {
			const scriptNameSnake = script.name;
			const scriptNameCamel = camelify(script.name);
			const scriptNamePascal = pascalify(script.name);

			const scriptId = `${moduleNamePascal}_${scriptNamePascal}`;

			const requestTypeName = `${scriptId}_Req`;
			const responseTypeName = `${scriptId}_Res`;

			const importPath = resolve(
				module.path,
				"scripts",
				`${scriptNameSnake}.ts`,
			);

			scriptImportsSource += dedent`
				// modules.${moduleNameCamel}.${scriptNameCamel}
				import type {
					Request as ${requestTypeName},
					Response as ${responseTypeName},
				} from ${JSON.stringify(importPath)};
			`;

			scriptSnakeInterfaceSource += dedent`
				${scriptNameSnake}: {
					request: ${requestTypeName};
					response: ${responseTypeName};
				};
			`;
			scriptCamelInterfaceSource += dedent`
				${scriptNameCamel}: {
					request: ${requestTypeName};
					response: ${responseTypeName};
				};
			`;

			moduleRegistryMap += `${scriptNameCamel}: ["${moduleNameSnake}", "${scriptNameSnake}"],\n`;
		}

		const moduleInterfaceNameSnake = `${moduleNamePascal}_Module`;
		const moduleInterfaceNameCamel = `${moduleNamePascal}_ModuleCamel`;

		moduleTypesSource += dedent`
			//
			// Types for ${module.name}
			//

			${scriptImportsSource}
			
			interface ${moduleInterfaceNameSnake} {
				${scriptSnakeInterfaceSource}
			}
			interface ${moduleInterfaceNameCamel} {
				${scriptCamelInterfaceSource}
			}
		`;

		moduleSnakeRegistrySource += `${moduleNameSnake}: ${moduleInterfaceNameSnake};`;
		moduleCamelRegistrySource += `${moduleNameCamel}: ${moduleInterfaceNameCamel};`;

		registryMapSource += dedent`
			${moduleNameCamel}: {
				${moduleRegistryMap}
			},
		`;
	}

	const typedefSource = dedent`
		${autoGenHeader()}

		export type RequestOf<T> = T extends { request: any } ? T["request"] : never;
		export type ResponseOf<T> = T extends { response: any } ? T["response"] : never;

		export type RegistryCallFn<ThisType> = <M extends keyof Registry & string, S extends keyof Registry[M] & string>(
			this: ThisType,
			module: M,
			script: S,
			req: RequestOf<Registry[M][S]>,
		) => Promise<ResponseOf<Registry[M][S]>>;

		interface Registry {
			${moduleSnakeRegistrySource}
		}

		interface RegistryCamel {
			${moduleCamelRegistrySource}
		}

		${moduleTypesSource}
	`;

	const camelLookupSource = dedent`
		${autoGenHeader()}

		export const camelToSnake = {
			${registryMapSource}
		} as const;
	`;

	await Deno.mkdir(dirname(typedefPath), { recursive: true });
	await Deno.writeTextFile(typedefPath, typedefSource);
	await Deno.writeTextFile(typemapPath, camelLookupSource);
}

export async function compileModuleTypeHelper(
	project: Project,
	module: Module,
) {
	const helperPath = typeGenPath(project, module);
	const typedefPath = relative(
		dirname(helperPath),
		resolve(
			project.path,
			"_gen",
			"registry.d.ts",
		),
	);

	const moduleNameSnake = module.name;
	const moduleNameCamel = camelify(module.name);

	const moduleDependenciesSnake = Object.keys(module.config.dependencies || {})
		.map((dependencyName) => `${dependencyName}: RegistryFull["${dependencyName}"]`)
		.join(";\n\t");
	const moduleDependenciesCamel = Object.keys(module.config.dependencies || {})
		.map((dependencyName) => camelify(dependencyName))
		.map((dependencyName) => `${dependencyName}: RegistryFullCamel["${dependencyName}"]`)
		.join(";\n\t");

	const source = dedent`
		${autoGenHeader()}
		import type { Registry as RegistryFull, RegistryCamel as RegistryFullCamel } from "${typedefPath}";
		export interface Registry {
			${moduleNameSnake}: RegistryFull["${moduleNameSnake}"];
			${moduleDependenciesSnake}
		}

		export interface RegistryCamel {
			${moduleNameCamel}: RegistryFullCamel["${moduleNameCamel}"];
			${moduleDependenciesCamel}
		}
	`;

	await Deno.mkdir(dirname(helperPath), { recursive: true });
	await Deno.writeTextFile(helperPath, source);
}

async function getUserConfigImport(module: Module, moduleRoot: string) {
	let userConfigImport = "";
	let userConfigType = "Record<string, never>";
	if (await hasUserConfigSchema(module)) {
		userConfigImport = `import { Config as UserConfig } from "${moduleRoot}/config.ts";`;
		userConfigType = "UserConfig";
	}
	return { userConfigImport, userConfigType };
}
