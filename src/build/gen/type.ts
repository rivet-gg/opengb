import {
	genDependencyCaseConversionMapPath,
	genDependencyTypedefPath,
	genActorCaseConversionMapPath,
	genActorTypedefPath,
	Project,
} from "../../project/mod.ts";
import { GeneratedCodeBuilder } from "./mod.ts";
import { camelify, pascalify } from "../../types/case_conversions.ts";
import { compilePublic } from "./public.ts";

export async function compileTypeHelpers(project: Project) {
	const typedefPath = genDependencyTypedefPath(project);
	const caseConversionPath = genDependencyCaseConversionMapPath(project);
	const dependencyTypedef = new GeneratedCodeBuilder(typedefPath, 4);
	const dependencyCaseConversionMap = new GeneratedCodeBuilder(caseConversionPath, 4);

	dependencyTypedef.append`
		export type RequestOf<T> = T extends { request: any } ? T["request"] : never;
		export type ResponseOf<T> = T extends { response: any } ? T["response"] : never;

		export type DependencyCallFn<ThisType> = <M extends keyof DependenciesSnake & string, S extends keyof DependenciesSnake[M] & string>(
			this: ThisType,
			module: M,
			script: S,
			req: RequestOf<DependenciesSnake[M][S]>,
		) => Promise<ResponseOf<DependenciesSnake[M][S]>>;
	`;

	const moduleTypes = dependencyTypedef.chunk.withNewlinesPerChunk(4);

	const moduleSnakeEntries = dependencyTypedef.chunk.withNewlinesPerChunk(1);
	const moduleCamelEntries = dependencyTypedef.chunk.withNewlinesPerChunk(1);

	for (const module of project.modules.values()) {
		moduleTypes.append`
			//
			// Types for ${module.name}
			//
		`;

		const scriptImports = moduleTypes.chunk.withNewlinesPerChunk(2);
		const scriptSnakeEntries = moduleTypes.chunk.withNewlinesPerChunk(1);
		const scriptCamelEntries = moduleTypes.chunk.withNewlinesPerChunk(1);
		const moduleCaseConversionMap = dependencyCaseConversionMap.chunk.withNewlinesPerChunk(1);

		for (const script of module.scripts.values()) {
			const scriptId = `${pascalify(module.name)}_${pascalify(script.name)}`;

			const requestTypeName = `${scriptId}_Req`;
			const responseTypeName = `${scriptId}_Res`;

			const importPath = dependencyTypedef.relative(
				module.path,
				"scripts",
				`${script.name}.ts`,
			);

			scriptImports.append`
				// modules.${camelify(module.name)}.${camelify(script.name)}
				import type {
					Request as ${requestTypeName},
					Response as ${responseTypeName},
				} from ${JSON.stringify(importPath)};
			`;

			scriptSnakeEntries.append`
				${script.name}: {
					request: ${requestTypeName};
					response: ${responseTypeName};
				};
			`;
			scriptCamelEntries.append`
				${camelify(script.name)}: {
					request: ${requestTypeName};
					response: ${responseTypeName};
				};
			`;

			moduleCaseConversionMap.append`
				${camelify(script.name)}: ["${module.name}", "${script.name}"],
			`;
		}

		const moduleInterfaceNameSnake = `${pascalify(module.name)}_Module`;
		const moduleInterfaceNameCamel = `${pascalify(module.name)}_ModuleCamel`;

		GeneratedCodeBuilder.wrap(
			`interface ${moduleInterfaceNameSnake} {`,
			scriptSnakeEntries,
			"}",
		);
		GeneratedCodeBuilder.wrap(
			`interface ${moduleInterfaceNameCamel} {`,
			scriptCamelEntries,
			"}",
		);

		moduleSnakeEntries.append`
			${module.name}: ${moduleInterfaceNameSnake};
		`;
		moduleCamelEntries.append`
			${camelify(module.name)}: ${moduleInterfaceNameCamel};
		`;

		// Wrap entries into an object
		GeneratedCodeBuilder.wrap(
			`${camelify(module.name)}: {`,
			moduleCaseConversionMap,
			"},",
		);
	}

	GeneratedCodeBuilder.wrap(
		"interface DependenciesSnake {",
		moduleSnakeEntries,
		"}",
	);
	GeneratedCodeBuilder.wrap(
		"interface DependenciesCamel {",
		moduleCamelEntries,
		"}",
	);

	// Wrap entries into a const object
	GeneratedCodeBuilder.wrap(
		`export const dependencyCaseConversionMap = {`,
		dependencyCaseConversionMap,
		`} as const;`,
	);

	await dependencyTypedef.write();
	await dependencyCaseConversionMap.write();

	await compilePublic(project);
}

export async function compileActorTypeHelpers(project: Project) {
	const typedefPath = genActorTypedefPath(project);
	const caseConversionPath = genActorCaseConversionMapPath(project);
	const actorTypedef = new GeneratedCodeBuilder(typedefPath, 4);
	const actorCaseConversionMap = new GeneratedCodeBuilder(caseConversionPath, 4);

	actorTypedef.append`
		export type RequestOf<T> = T extends { request: any } ? T["request"] : never;
		export type ResponseOf<T> = T extends { response: any } ? T["response"] : never;

		export type ActorProxyLookupFn<ThisType> = <M extends keyof ActorsSnake & string, S extends keyof ActorsSnake[M] & string>(
			this: ThisType,
			module: M,
			script: S,
			req: RequestOf<ActorsSnake[M][S]>,
		) => Promise<ResponseOf<ActorsSnake[M][S]>>;
	`;

	const moduleTypes = actorTypedef.chunk.withNewlinesPerChunk(4);

	const moduleSnakeEntries = actorTypedef.chunk.withNewlinesPerChunk(1);
	const moduleCamelEntries = actorTypedef.chunk.withNewlinesPerChunk(1);

	for (const module of project.modules.values()) {
		moduleTypes.append`
			//
			// Types for ${module.name}
			//
		`;

		const actorImports = moduleTypes.chunk.withNewlinesPerChunk(2);
		const actorSnakeEntries = moduleTypes.chunk.withNewlinesPerChunk(1);
		const actorCamelEntries = moduleTypes.chunk.withNewlinesPerChunk(1);
		const moduleCaseConversionMap = actorCaseConversionMap.chunk.withNewlinesPerChunk(1);

		for (const actor of module.actors.values()) {
			const actorId = `${pascalify(module.name)}_${pascalify(actor.name)}`;

			const actorTypeName = `${actorId}_Actor`;

			const importPath = actorTypedef.relative(
				module.path,
				"actors",
				`${actor.name}.ts`,
			);

			actorImports.append`
				// modules.${camelify(module.name)}.${camelify(actor.name)}
				import type {
					Actor as ${actorTypeName},
				} from ${JSON.stringify(importPath)};
			`;

			actorSnakeEntries.append`
				${actor.name}: ${actorTypeName};
			`;
			actorCamelEntries.append`
				${camelify(actor.name)}: ${actorTypeName};
			`;

			moduleCaseConversionMap.append`
				${camelify(actor.name)}: ["${module.name}", "${actor.name}"],
			`;
		}

		const moduleInterfaceNameSnake = `${pascalify(module.name)}_Module`;
		const moduleInterfaceNameCamel = `${pascalify(module.name)}_ModuleCamel`;

		GeneratedCodeBuilder.wrap(
			`interface ${moduleInterfaceNameSnake} {`,
			actorSnakeEntries,
			"}",
		);
		GeneratedCodeBuilder.wrap(
			`interface ${moduleInterfaceNameCamel} {`,
			actorCamelEntries,
			"}",
		);

		moduleSnakeEntries.append`
			${module.name}: ${moduleInterfaceNameSnake};
		`;
		moduleCamelEntries.append`
			${camelify(module.name)}: ${moduleInterfaceNameCamel};
		`;

		// Wrap entries into an object
		GeneratedCodeBuilder.wrap(
			`${camelify(module.name)}: {`,
			moduleCaseConversionMap,
			"},",
		);
	}

	GeneratedCodeBuilder.wrap(
		"interface ActorsSnake {",
		moduleSnakeEntries,
		"}",
	);
	GeneratedCodeBuilder.wrap(
		"interface ActorsCamel {",
		moduleCamelEntries,
		"}",
	);

	// Wrap entries into a const object
	GeneratedCodeBuilder.wrap(
		`export const actorCaseConversionMap = {`,
		actorCaseConversionMap,
		`} as const;`,
	);

	await actorTypedef.write();
	await actorCaseConversionMap.write();

	await compilePublic(project);
}
