import { camelify, pascalify } from "../../types/case_conversions.ts";
import { exists, glob, resolve } from "../../deps.ts";
import { GeneratedCodeBuilder } from "../../build/gen/code_builder.ts";
import { Project } from "../../project/mod.ts";
import dynamicArchive from "../../../artifacts/dynamic_archive.json" with { type: "json" };

export async function generateTypescriptAddons(project: Project, sdkGenPath: string) {
	// HACK: Fix sloppy imports
	const files = await glob.glob(["**/*.ts"], { cwd: sdkGenPath, nodir: true });
	for await (const file of files) {
		const path = resolve(sdkGenPath, file);
		const content = await Deno.readTextFile(path);
		const fixedContent = content.replace(
			/((?:import|export)[\s\S]*?from\s+["'][^"']+)(["'])/g,
			(match, p1, p2) => {
				return p1.endsWith(".ts") ? match : `${p1}.ts${p2}`;
			},
		);
		await Deno.writeTextFile(path, fixedContent);
	}

	await generateIndex(sdkGenPath);
	await generateRuntime(sdkGenPath);
	await generateApiClients(project, sdkGenPath);
}

async function generateIndex(sdkGenPath: string) {
	// Update index to only export our custom api
	const indexBuilder = new GeneratedCodeBuilder(resolve(sdkGenPath, "src", "apis", "index.ts"));

	indexBuilder.chunk.append`
		/* tslint:disable */
		/* eslint-disable */
		export * from './backend.ts';
	`;

	await indexBuilder.write();
}

async function generateRuntime(sdkGenPath: string) {
	// Write new runtime
	await Deno.writeTextFile(
		resolve(sdkGenPath, "src", `runtime.ts`),
		dynamicArchive["sdk/typescript/runtime.ts"],
	);
}

async function generateApiClients(project: Project, sdkGenPath: string) {
	const apiBuilder = new GeneratedCodeBuilder(resolve(sdkGenPath, "src", "apis", "backend.ts"));

	apiBuilder.append`import * as runtime from '../runtime.ts';`;

	const moduleImports = apiBuilder.chunk;
	const modules = apiBuilder.chunk;

	// Create dir for module apis
	try {
		await Deno.mkdir(resolve(sdkGenPath, "src", "apis", "modules"));
	} catch (e) {
		if (!(e instanceof Deno.errors.AlreadyExists)) {
			throw e;
		}
	}

	for (const mod of project.modules.values()) {
		const moduleNameCamel = camelify(mod.name);
		const moduleNamePascal = pascalify(mod.name);

		// Create module api class
		const moduleApiBuilder = new GeneratedCodeBuilder(
			resolve(sdkGenPath, "src", "apis", "modules", `${mod.name}.ts`),
		);

		moduleApiBuilder.append`import * as runtime from '../../runtime.ts';`;

		const scriptImports = moduleApiBuilder.chunk;
		const scripts = moduleApiBuilder.chunk;

		for (const script of mod.scripts.values()) {
			const scriptNameCamel = camelify(script.name);
			const scriptNamePascal = pascalify(script.name);
			const requestName = `${moduleNamePascal}${scriptNamePascal}Request`;
			const responseName = `${moduleNamePascal}${scriptNamePascal}Response`;
			const path = `/modules/${mod.name}/scripts/${script.name}/call`;

			// Generate missing free-form objects
			if (!await exists(resolve(sdkGenPath, "src", "models", `${requestName}.ts`))) {
				await generateFreeFormInterface(requestName, resolve(sdkGenPath, "src", "models", `${requestName}.ts`));
				await Deno.writeTextFile(
					resolve(sdkGenPath, "src", "models", `index.ts`),
					`export * from './${requestName}.ts';\n`,
					{ append: true },
				);
			}
			if (!await exists(resolve(sdkGenPath, "src", "models", `${responseName}.ts`))) {
				await generateFreeFormInterface(responseName, resolve(sdkGenPath, "src", "models", `${responseName}.ts`));
				await Deno.writeTextFile(
					resolve(sdkGenPath, "src", "models", `index.ts`),
					`export * from './${responseName}.ts';\n`,
					{ append: true },
				);
			}

			scriptImports.append`
				import type { ${requestName}, ${responseName} } from '../../models/index.ts';
				import { ${requestName}ToJSON, ${responseName}FromJSON } from '../../models/index.ts';
			`;
			scripts.append`
				public async ${scriptNameCamel}(request: ${requestName}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<${responseName}> {
					const queryParameters: any = {};

					const headerParameters: runtime.HTTPHeaders = {};
					headerParameters['Content-Type'] = 'application/json';

					const response = await this.request({
						path: \`${path}\`,
						method: 'POST',
						headers: headerParameters,
						query: queryParameters,
						body: ${requestName}ToJSON(request),
					}, initOverrides);

					return ${responseName}FromJSON(await response.json());
				}
			`;
		}

		GeneratedCodeBuilder.wrap(
			`export class ${moduleNamePascal} extends runtime.BaseAPI {`,
			scripts,
			"}",
		);

		await moduleApiBuilder.write();

		// Add module to main api class
		moduleImports.append`import { ${moduleNamePascal} } from "./modules/${mod.name}.ts";`;
		modules.append`
			protected _${moduleNameCamel}: ${moduleNamePascal} | undefined;

			public get ${moduleNameCamel}(): ${moduleNamePascal} {
				return this._${moduleNameCamel} ??= new ${moduleNamePascal}(this.configuration);
			}
		`;
	}

	GeneratedCodeBuilder.wrap(
		`
		export class Backend extends runtime.BaseAPI {
			constructor(config: runtime.ConfigurationParameters) {
				super(new runtime.Configuration(config));
			}
		`,
		modules,
		"}",
	);

	await apiBuilder.write();
}

async function generateFreeFormInterface(interfaceName: string, path: string) {
	const schemaBuilder = new GeneratedCodeBuilder(path);

	schemaBuilder.append`
		/* tslint:disable */
		/* eslint-disable */

		/**
		 * 
		 * @export
		 * @interface ${interfaceName}
		 */
		export interface ${interfaceName} { }

		/**
		 * Check if a given object implements the ${interfaceName} interface.
		 */
		export function instanceOf${interfaceName}(_value: object): _value is ${interfaceName} {
			return true;
		}

		export function ${interfaceName}FromJSON(json: any): ${interfaceName} {
			return ${interfaceName}FromJSONTyped(json, false);
		}

		export function ${interfaceName}FromJSONTyped(json: any, ignoreDiscriminator: boolean): ${interfaceName} {
			if (json == null) {
				return json;
			}
			return { };
		}

		export function ${interfaceName}ToJSON(value?: ${interfaceName} | null): any {
			if (value == null) {
				return value;
			}
			return { };
		}
	`;

	await schemaBuilder.write();
}
