import { dedent } from "./deps.ts";
import { dirname, resolve } from "../deps.ts";
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
	const runtimePath = genRuntimeModPath(project);

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
		import { Registry as RegistryTypeInner, RegistryCamel as RegistryCamelTypeInner } from "./registry.d.ts";
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
	const helperPath = moduleGenPath(project, module);
	await Deno.mkdir(dirname(helperPath), { recursive: true });
	await Deno.writeTextFile(helperPath, source);
}

export async function compileTestHelper(
	project: Project,
	module: Module,
) {
	const runtimePath = genRuntimeModPath(project);
	const registryMapPath = genRegistryMapPath(project);

	const { userConfigImport, userConfigType } = await getUserConfigImport(module, "..");

	const source = dedent`
		${autoGenHeader()}
		import * as module from "./mod.ts";
		import { Runtime, TestContext as TestContextInner } from "${runtimePath}";
		import { Registry as RegistryTypeInner, RegistryCamel as RegistryCamelTypeInner } from "./registry.d.ts";
		import { camelToSnake } from "${registryMapPath}";
		import config from "${project.path}/_gen/runtime_config.ts";
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
	const helperPath = testGenPath(project, module);
	await Deno.mkdir(dirname(helperPath), { recursive: true });
	await Deno.writeTextFile(helperPath, source);
}

export async function compileScriptHelper(
	project: Project,
	module: Module,
	script: Script,
) {
	const runtimePath = genRuntimeModPath(project);

	const { userConfigImport, userConfigType } = await getUserConfigImport(module, "../..");

	const source = dedent`
		${autoGenHeader()}
		import * as module from "../mod.ts";
		import { ScriptContext as ScriptContextInner } from "${runtimePath}";
		import { Registry as RegistryTypeInner, RegistryCamel as RegistryCamelTypeInner } from "../registry.d.ts";
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
	const helperPath = scriptGenPath(project, module, script);
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
			` + "\n";
			scriptCamelInterfaceSource += dedent`
				${scriptNameCamel}: {
					request: ${requestTypeName};
					response: ${responseTypeName};
				};
			` + "\n";

			moduleRegistryMap += `${scriptNameCamel}: ["${moduleNameSnake}", "${scriptNameSnake}"],\n`;
		}

		const moduleInterfaceNameSnake = `${moduleNamePascal}_Module`;
		const moduleInterfaceNameCamel = `${moduleNamePascal}_ModuleCamel`;
		const headerTypesSource = dedent`
			//
			// Types for ${module.name}
			//
		`;

		scriptSnakeInterfaceSource = scriptSnakeInterfaceSource
			.split("\n")
			.filter((line) => line.trim() !== "")
			.map((line) => `\t${line}`)
			.join("\n");

		scriptCamelInterfaceSource = scriptCamelInterfaceSource
			.split("\n")
			.filter((line) => line.trim() !== "")
			.map((line) => `\t${line}`)
			.join("\n");

		const interfaceSource = [
			`interface ${moduleInterfaceNameSnake} {`,
			scriptSnakeInterfaceSource,
			"}",
			`interface ${moduleInterfaceNameCamel} {`,
			scriptCamelInterfaceSource,
			"}",
		].join("\n");

		moduleTypesSource += headerTypesSource + "\n\n";
		moduleTypesSource += scriptImportsSource + "\n\n";
		moduleTypesSource += interfaceSource + "\n\n\n\n";

		moduleSnakeRegistrySource += dedent`
			${moduleNameSnake}: ${moduleInterfaceNameSnake};
		` + "\n";
		moduleCamelRegistrySource += dedent`
			${moduleNameCamel}: ${moduleInterfaceNameCamel};
		` + "\n";

		moduleRegistryMap = moduleRegistryMap
			.split("\n")
			.filter((line) => line.trim() !== "")
			.map((line) => `\t${line}`)
			.join("\n");

		registryMapSource += [
			`${moduleNameCamel}: {`,
			moduleRegistryMap,
			"},",
		].join("\n") + "\n";
	}

	moduleSnakeRegistrySource = moduleSnakeRegistrySource
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => `\t${line.trim()}`)
		.join("\n");

	moduleCamelRegistrySource = moduleCamelRegistrySource
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => `\t${line.trim()}`)
		.join("\n");

	registryMapSource = registryMapSource
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => `\t${line}`)
		.join("\n");

	const utilityTypeSource = autoGenHeader() + "\n\n" + dedent`
		export type RequestOf<T> = T extends { request: any } ? T["request"] : never;
		export type ResponseOf<T> = T extends { response: any } ? T["response"] : never;

		export type RegistryCallFn<ThisType> = <M extends keyof Registry & string, S extends keyof Registry[M] & string>(
			this: ThisType,
			module: M,
			script: S,
			req: RequestOf<Registry[M][S]>,
		) => Promise<ResponseOf<Registry[M][S]>>;
	`;
	const registryTypesSource = [
		"interface Registry {",
		moduleSnakeRegistrySource,
		"}",
		"interface RegistryCamel {",
		moduleCamelRegistrySource,
		"}",
	].join("\n");

	const typedefSource = [
		utilityTypeSource,
		registryTypesSource,
		moduleTypesSource,
	].join("\n\n");

	const camelLookupSource = [
		autoGenHeader(),
		"export const camelToSnake = {",
		registryMapSource,
		"} as const;",
	].join("\n");

	await Deno.mkdir(dirname(typedefPath), { recursive: true });
	await Deno.writeTextFile(typedefPath, typedefSource);
	await Deno.writeTextFile(typemapPath, camelLookupSource);
}

export async function compileModuleTypeHelper(
	project: Project,
	module: Module,
) {
	const typedefPath = resolve(
		project.path,
		"_gen",
		"registry.d.ts",
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
		import { Registry as RegistryFull, RegistryCamel as RegistryFullCamel } from "${typedefPath}";
		export interface Registry {
			${moduleNameSnake}: RegistryFull["${moduleNameSnake}"];
			${moduleDependenciesSnake}
		}

		export interface RegistryCamel {
			${moduleNameCamel}: RegistryFullCamel["${moduleNameCamel}"];
			${moduleDependenciesCamel}
		}
	`;

	const helperPath = typeGenPath(project, module);
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
