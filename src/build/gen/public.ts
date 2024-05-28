import { genModulePublicInternal, Project, publicPath } from "../../project/mod.ts";
import { GeneratedCodeBuilder } from "./mod.ts";
import { exists } from "../../deps.ts";
import { genModulePublicExternal } from "../../project/project.ts";
import { camelify } from "../../types/case_conversions.ts";

export async function compilePublic(project: Project) {
	// Export public data in internal module
	//
	// These will be re-exported in external modules
	for (const module of project.modules.values()) {
		const reexporter = new GeneratedCodeBuilder(genModulePublicInternal(project, module), 2);

		// If it exists, reexport the `public.ts` file for this module
		if (await exists(publicPath(module), { isFile: true })) {
			reexporter.append`
				export * from ${JSON.stringify(reexporter.relative(publicPath(module)))};
			`;
		}

		// Export the module's name as a constant
		reexporter.append`export const __CANONICAL_MODULE_NAME = "${module.name}";`;

		await reexporter.write();
	}

	// Re-export public modules for module.gen.ts. This gets imported as
	// `Module` in the module.gen.ts.
	//
	// This exports the dependencies (the `genModulePublicInternal` files) with
	// their given module names.
	for (const module of project.modules.values()) {
		const reexporter = new GeneratedCodeBuilder(genModulePublicExternal(project, module), 2);

		for (const depName of Object.keys(module.config.dependencies || {})) {
			const dependency = project.modules.get(depName)!;

			const internalPath = reexporter.relative(genModulePublicInternal(project, dependency));

			reexporter.append`
				// Reexports public utils for ${depName}
				export * as ${camelify(depName)} from ${JSON.stringify(internalPath)};
			`;
		}

		await reexporter.write();
	}
}
