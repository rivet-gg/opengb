#!/usr/bin/env deno run -A

import { resolve } from "https://deno.land/std@0.214.0/path/mod.ts";
import { emptyDir, copy } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { assert, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ModuleMeta } from "../../../packages/toolchain/src/build/meta.ts";
import { join, ctx, Templates, markdownDocsFromSchema } from "./generate.ts";

interface ModuleInfo {
	module: ModuleMeta;
	name: string;
	scripts: ModuleMeta["scripts"];
	scriptsSorted: [string, ModuleMeta["scripts"][string]][];
	publicScripts: [string, ModuleMeta["scripts"][string]][];
	internalScripts: [string, ModuleMeta["scripts"][string]][];
	dependencies: ModuleMeta["config"]["dependencies"] & {};
	authors: ModuleMeta["config"]["authors"];
	errors: ModuleMeta["config"]["errors"];
	docsPath: string | null;
}

async function transformModuleInfo(moduleName: string, module: ModuleMeta): Promise<ModuleInfo> {
	const publicScripts = Object.entries(module.scripts)
		.filter(([_, x]) => x.config.public);
	const internalScripts = Object.entries(module.scripts)
		.filter(([_, x]) => !x.config.public);

	// Validate module
	assertExists(module.config.name, `Missing name for module "${moduleName}"`);
	assertExists(
		module.config.description,
		`Missing description for module "${moduleName}"`,
	);
	assertExists(module.config.icon, `Missing icon for module "${moduleName}"`);
	assertExists(module.config.tags, `Missing tags for module "${moduleName}"`);
	assertExists(
		module.config.status,
		`Missing status for module "${moduleName}"`,
	);

	// Validate scripts
	for (let key in module.scripts) {
		if (!module.scripts[key]?.config.name) {
			throw new Error(`Script missing name: ${moduleName}.${key}`);
		}
	}
	const scriptsSorted = Object.entries(module.scripts)
		.sort((a, b) => a[1].config.name!.localeCompare(b[1].config.name!));
	for (const [scriptName, script] of scriptsSorted) {
		assertExists(script.config.name, `Missing name for script "${scriptName}"`);
	}

	// Valdiate errors
	if (module.config.errors) {
		for (const [errorName, error] of Object.entries(module.config.errors)) {
			assertExists(error.name, `Missing name for error "${errorName}"`);
		}
	}

	// Check per-module docs
	const perModuleDocsPath = resolve(module.path, "docs");
	let stat: Deno.FileInfo | null = null;
	try {
		stat = await Deno.stat(perModuleDocsPath);
	} catch {
		// TODO: Add docs so that this doesn't make things too verbose
		// console.error(
		// 	"No docs found for module",
		// 	moduleName,
		// 	"at",
		// 	perModuleDocsPath,
		// );
	}
	if (stat) assert(stat.isDirectory, `Docs path for module "${moduleName}" is not a directory`);

	return {
		module,
		name: moduleName,
		scripts: module.scripts,
		scriptsSorted,
		publicScripts,
		internalScripts,
		dependencies: module.config.dependencies ?? {},
		authors: module.config.authors ?? [],
		errors: module.config.errors,
		docsPath: stat ? perModuleDocsPath : null,
	};
}

function addToNav(
	nav: any,
	{ name, module, publicScripts, internalScripts }: ModuleInfo,
) {
	let pages: any[] = [`modules/${name}/overview`];
	if (module.hasUserConfigSchema) {
		pages.push(`modules/${name}/config`);
	}
	if (publicScripts.length > 0) pages.push({
		"group": "Scripts (Public)",
		"pages": publicScripts
			.sort((a, b) => a[1].config.name!.localeCompare(b[1].config.name!))
			.map(([scriptName]) => `modules/${name}/scripts/${scriptName}`),
	});

	if (internalScripts.length > 0) pages.push({
		"group": "Scripts (Internal)",
		"pages": internalScripts
			.sort((a, b) => a[1].config.name!.localeCompare(b[1].config.name!))
			.map(([scriptName]) => `modules/${name}/scripts/${scriptName}`),
	});

	nav.pages.push({
		"icon": module.config.icon,
		"group": module.config.name,
		"pages": pages,
	});
}

function renderDeps(moduleInfo: ModuleInfo) {
	if (Object.keys(moduleInfo.dependencies).length === 0) {
		return "_No dependencies_";
	} else {
		return Object.keys(moduleInfo.dependencies)
			.map((dep) => `- [\`${dep}\`](/modules/${dep}/overview)`)
			.join("\n");
	}
}

function renderInstall(moduleInfo: ModuleInfo) {
	if (moduleInfo.module.hasUserConfigSchema) {
		return join(
			`"modules": {`,
			`  "${moduleInfo.name}": {`,
			`    "config": {`,
			`      // Your config here. See config docs for more details.`,
			`    }`,
			`  }`,
			`}`,
		);
	} else {
		return join(
			`"modules": {`,
			`  "${moduleInfo.name}": {}`,
			`}`,
		);
	}

}

function renderAuthors(moduleInfo: ModuleInfo) {
	if (moduleInfo.authors) {
		return moduleInfo.authors
			.map((author) => `- [${author}](https://github.com/${author})`)
			.join("\n");
	} else {
		return "_No authors_";
	}
}

function renderErrors(moduleInfo: ModuleInfo) {
	if (Object.entries(moduleInfo.errors).length) {
		return Object.entries(moduleInfo.errors)
			.sort((a, b) => a[1].name!.localeCompare(b[1].name!))
			.map(([errorName, error]) => `- **${error.name}** (\`${errorName}\`) ${error.description ?? ""}`)
			.join("\n");
	} else {
		return "_No errors_";
	}
}

function renderConfig(moduleInfo: ModuleInfo) {
	if (moduleInfo.module.hasUserConfigSchema) {
		return join(
			`## Config`,
			`<Card title="View Config" icon="square-sliders" href="/modules/${moduleInfo.name}/config"></Card>`
		);
	} else {
		return "";
	}
}

function scriptCard(moduleName: string, script: ModuleMeta["scripts"][string]) {
	return join(
		`<Card title="${script.config.name}" icon="code" href="/modules/${moduleName}/scripts/${script.name}">`,
		`  ${script.config.description ?? ""}`,
		`</Card>`,
	);
}

function scriptCards({ publicScripts, internalScripts, name }: ModuleInfo) {
	const publicScriptCards = publicScripts.map(([,script]) => scriptCard(name, script));
	const internalScriptCards = internalScripts.map(([,script]) => scriptCard(name, script));

	const publicCards = publicScriptCards.length ? publicScriptCards.join("\n") : "_No public scripts._";
	const internalCards = internalScriptCards.length ? internalScriptCards.join("\n") : "_No internal scripts._";
	return {
		publicCards,
		internalCards,
	}
}

interface ModuleFiles {
    overview: string;
    docsDir: string | null;
    config: string | null;
    scripts: Record<string, string>;
}

export async function renderModule(
    templates: Templates,
    moduleName: string,
    module: ModuleMeta,
    modulesNav: any,
): Promise<ModuleFiles> {
	console.log("Generating module", moduleName);

	const moduleInfo = await transformModuleInfo(moduleName, module);
	const {
		scriptsSorted,
		docsPath,
	} = moduleInfo;

	// Add nav
	addToNav(modulesNav, moduleInfo);

	// Per-module docs
	const modulePath = resolve(ctx.docsModulesPath, moduleName);
	await emptyDir(modulePath);

	// Render
	const dependencies = renderDeps(moduleInfo);
	const install = renderInstall(moduleInfo);
	const authors = renderAuthors(moduleInfo);
	const errors = renderErrors(moduleInfo);

	const { publicCards, internalCards } = scriptCards(moduleInfo);

	const configSection = renderConfig(moduleInfo);

	// Generate overview
	const overview = templates.moduleOverview
		.replace(/%%NAME%%/g, moduleName)
		.replace(/%%DISPLAY_NAME%%/g, module.config.name!)
		.replace(/%%STATUS%%/g, module.config.status!)
		.replace(/%%DATABASE%%/g, module.db ? "Yes" : "No")
		.replace(/%%AUTHORS%%/g, authors)
		.replace(/%%DEPENDENCIES%%/g, dependencies)
		.replace(/%%DESCRIPTION%%/g, module.config.description!)
		.replace(/%%INSTALL_CONFIG%%/g, install)
		.replace(/%%CONFIG%%/g, configSection)
		.replace(/%%SCRIPTS_PUBLIC%%/g, publicCards)
		.replace(/%%SCRIPTS_INTERNAL%%/g, internalCards)
		.replace(/%%ERRORS%%/g, errors);

    const output: ModuleFiles = {
        overview,
        scripts: {},
        docsDir: docsPath,
        config: null,
    };

	await emptyDir(resolve(modulePath, "scripts"));
	for (const [scriptName, script] of scriptsSorted) {
		let requestExamples = "<RequestExample>\n";
		requestExamples += templates.examplePrivate;
		if (script.config.public) {
			requestExamples += templates.examplePublic;
		}
		requestExamples += `\n</RequestExample>`;
		requestExamples = requestExamples
			.replace(/%%NAME%%/g, scriptName)
			.replace(/%%NAME_CAMEL%%/g, script.nameCamel)
			.replace(/%%NAME_PASCAL%%/g, script.namePascal)
			.replace(/%%MODULE_NAME%%/g, moduleName)
			.replace(/%%MODULE_NAME_CAMEL%%/g, module.nameCamel)
			.replace(/%%MODULE_NAME_PASCAL%%/g, module.namePascal);

        output.scripts[scriptName] = templates.script
			.replace(/%%NAME%%/g, scriptName)
			.replace(/%%NAME_CAMEL%%/g, script.nameCamel)
			.replace(/%%NAME_PASCAL%%/g, script.namePascal)
			.replace(/%%DISPLAY_NAME%%/g, script.config.name!)
			.replace(/%%MODULE_NAME%%/g, moduleName)
			.replace(/%%MODULE_NAME_CAMEL%%/g, module.nameCamel)
			.replace(/%%MODULE_NAME_PASCAL%%/g, module.namePascal)
			.replace(/%%MODULE_DISPLAY_NAME%%/g, module.config.name!)
			.replace(/%%DESCRIPTION%%/g, script.config.description ?? "")
			.replace(/%%PUBLIC%%/g, script.config.public ? "Yes" : "No")
			.replace(/%%REQUEST_EXAMPLES%%/g, requestExamples)
			.replace(
				/%%REQUEST_SCHEMA%%/g,
				await markdownDocsFromSchema(script.requestSchema, "Request"),
			)
			.replace(
				/%%RESPONSE_SCHEMA%%/g,
				await markdownDocsFromSchema(script.responseSchema, "Response"),
			);

	}
    if (module.hasUserConfigSchema) {
        const defaultValue = JSON.stringify(module.config.defaultConfig ?? {}, null, 4);
        output.config = templates.moduleConfig
            .replace(/%%MODULE_NAME%%/g, moduleName)
            .replace(/%%SCHEMA%%/g, await markdownDocsFromSchema(module.userConfigSchema!, "Config"))
            .replace(/%%DEFAULT_VALUE%%/g, defaultValue);
    }

    return output;
}
