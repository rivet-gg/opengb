#!/usr/bin/env deno run -A

import { resolve } from "https://deno.land/std@0.214.0/path/mod.ts";
import { emptyDir, copy } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { zod2md } from "npm:zod2md";
import { ModuleMeta, ProjectMeta } from "../../../packages/toolchain/src/build/meta.ts";
import { convertSerializedSchemaToZodConstant } from "../../../packages/toolchain/src/build/schema/deserializer.ts";
import { readline } from "https://deno.land/x/readline@v1.1.0/mod.ts";
import * as Project from "./project.ts";
import { renderModule } from "./module.ts";

// MARK: Paths
const DOCS_ROOT = resolve(import.meta.dirname!, "..", "..");
const OPENGB_ROOT = resolve(
	DOCS_ROOT,
	"..",
);

const TEST_PROJECT_PATH = (() => {
	const envProjectPath = Deno.env.get("TEST_PROJECT_PATH");
	if (envProjectPath) return resolve(envProjectPath);
	else return resolve(
		DOCS_ROOT,
		"..",
		"..",
		"opengb-modules",
		"tests",
		"basic",
	);
})();


const DOCS_MODULES_PATH = resolve(DOCS_ROOT, "modules");

export const ctx = {
	docsRoot: DOCS_ROOT,
	openGBRoot: OPENGB_ROOT,
	testProjectPath: TEST_PROJECT_PATH,
	docsModulesPath: DOCS_MODULES_PATH,
};

export function join(...lines: string[]) {
	return lines.join("\n");
}

// MARK: Templates/Components
export interface Templates {
	modulesOverview: string;
	moduleOverview: string;
	moduleConfig: string;
	script: string;
	examplePrivate: string;
	examplePublic: string;
	projectConfig: string;
}

async function loadTemplates(): Promise<Templates> {
	// Load templates
	console.log("Loading templates");

	const TEMPLATES_PATH = resolve(DOCS_ROOT, "_internal", "templates");
	const [
		modulesOverview,
		moduleOverview,
		moduleConfig,
		script,
		examplePrivate,
		examplePublic,
		projectConfig,
	] = await Promise.all([
		Deno.readTextFile(resolve(TEMPLATES_PATH, "modules_overview.mdx")),
		Deno.readTextFile(resolve(TEMPLATES_PATH, "module_overview.mdx")),
		Deno.readTextFile(resolve(TEMPLATES_PATH, "module_config.mdx")),
		Deno.readTextFile(resolve(TEMPLATES_PATH, "script.mdx")),
		Deno.readTextFile(resolve(TEMPLATES_PATH, "example_private.mdx")),
		Deno.readTextFile(resolve(TEMPLATES_PATH, "example_public.mdx")),
		Deno.readTextFile(resolve(TEMPLATES_PATH, "project_config.mdx")),
	]);
	return {
		modulesOverview,
		moduleOverview,
		moduleConfig,
		script,
		examplePrivate,
		examplePublic,
		projectConfig,
	};
}

function moduleCard(moduleName: string, module: ModuleMeta) {
	return join(
		`<Card title="${module.config.name}" icon="${module.config.icon}" href="/modules/${moduleName}/overview">`,
		`  <div>${module.config.description}</div>`,
		`  <Tags tags={${JSON.stringify([module.config.status, ...module.config.tags!])}} />`,
		`</Card>`,
	);
}

function moduleCards(modulesSorted: [string, ModuleMeta][]) {
	const moduleCards = modulesSorted.map(([moduleName, module]) => moduleCard(moduleName, module));
	return join(
		`export const ModuleCards = ({ cols }) => (`,
		`  <>`,
		`    <p>These modules are thoroughly reviewed, tested, and documented to help you get your game backend up and running as quickly as possible. Learn more about <a href="/build">creating your own module</a> and <a href="/docs/registries">using your own registries</a>.</p>`,

		`    <CardGroup cols={cols ?? 2}>`,
		`      <Card title="Build your own" icon="plus" href="/build" />`,
		`      ${moduleCards.join("")}`,
		`    </CardGroup>`,
		`  </>`,
		`);`,
	);
}

export async function markdownDocsFromFile(entry: string) {
	let markdown = await zod2md({
		entry,
		title: "",
	});
	markdown = markdown.replace(/^#\s.*$/gm, "").replace(/^(#+)\s/gm, "#$1 ");
	return markdown;
}

export async function markdownDocsFromSchema(schema: any, name: string) {
	let schemaTs = `import { z } from "npm:zod@3.23.8";\n`;
	schemaTs += convertSerializedSchemaToZodConstant(schema, { name, export: true });

	const tempFilePath = await Deno.makeTempFile({ suffix: ".ts" });
	await Deno.writeTextFile(tempFilePath, schemaTs);

	return await markdownDocsFromFile(tempFilePath);
}


// MARK: Generation
async function generateModuleCards(modulesSorted: [string, ModuleMeta][]) {
	await Deno.writeTextFile(
		resolve(DOCS_ROOT, "snippets", "module-cards.mdx"),
		moduleCards(modulesSorted),
	);
}

async function generateModulesOverview(modulesOverviewTemplate: string) {
	await Deno.writeTextFile(
		resolve(DOCS_ROOT, "modules", "overview.mdx"),
		modulesOverviewTemplate,
	);
}

async function generateMintPlaceholder() {
	function replacePagesWith(pages: any, replaceWith: string): any {
		const newPages: any[] = [];
		for (const page of pages) {
			if (typeof page === "string") {
				newPages.push(replaceWith);
			} else {
				newPages.push({
					...page,
					pages: replacePagesWith(page.pages, replaceWith),
				});
			}
		}

		return newPages;
	}

	const mint = JSON.parse(
		await Deno.readTextFile(
			resolve(DOCS_ROOT, "mint.json"),
		),
	);

	// Replace pages with placeholder
	const placeholderMint = {
		...mint,
		navigation: replacePagesWith(mint.navigation, "building"),
	};

	await Deno.writeTextFile(
		resolve(DOCS_ROOT, "mint.json"),
		JSON.stringify(placeholderMint, null, 2),
	);
}

async function generateMintTemplate(modulesNav: any) {
	const mintTemplate = JSON.parse(
		await Deno.readTextFile(
			resolve(DOCS_ROOT, "mint.template.json"),
		),
	);
	mintTemplate.navigation.push(modulesNav);
	await Deno.writeTextFile(
		resolve(DOCS_ROOT, "mint.json"),
		JSON.stringify(mintTemplate, null, 2),
	);
}

async function generateProjectConfig(templates: Templates) {
	const configSchema = await markdownDocsFromFile(
		resolve(OPENGB_ROOT, "packages", "toolchain", "src", "config", "project.ts"),
	);
	await Deno.writeTextFile(
		resolve(DOCS_ROOT, "docs", "project-config.mdx"),
		templates.projectConfig.replace(/%%SCHEMA%%/g, configSchema)
	);
}
async function generateModuleConfig() {
	const configSchema = await markdownDocsFromFile(
		resolve(OPENGB_ROOT, "packages", "toolchain", "src", "config", "module.ts"),
	);
	await Deno.writeTextFile(
		resolve(DOCS_ROOT, "docs", "build", "module-config.mdx"),
		join(
			`---`,
			`title: "Config (module.json)"`,
			`icon: square-sliders`,
			`---`,
			``,
			`# Schema`,
			``,
			`${configSchema}`,
		),
	);
}

async function generateModule(
    templates: Templates,
    moduleName: string,
    module: ModuleMeta,
    modulesNav: any,
) {
	const { overview, config, scripts, docsDir } = await renderModule(templates, moduleName, module, modulesNav);

	const modulePath = resolve(ctx.docsModulesPath, moduleName);
	await emptyDir(modulePath);
	if (docsDir) await copy(docsDir, modulePath, { overwrite: true });


	await emptyDir(resolve(modulePath, "scripts"));
	for (const [scriptName, scriptContent] of Object.entries(scripts)) {
		await Deno.writeTextFile(
			resolve(modulePath, "scripts", `${scriptName}.mdx`),
			scriptContent,
		);
	}
	await Deno.writeTextFile(resolve(modulePath, "overview.mdx"), overview);
	if (config) await Deno.writeTextFile(resolve(modulePath, "config.mdx"), config);
}

if (!Deno.env.get("SKIP_BUILD_MODULES")) {
	if (!Deno.env.get("SKIP_BUILD_OPENGB")) {
		await Project.buildOpenGB();
	}

	await Project.buildOpenGB();
}

async function generate(meta: ProjectMeta, templates: Templates, abortSignal: AbortSignal) {
	// await copy(resolve(DOCS_ROOT, "mint.default.json"), resolve(DOCS_ROOT, "mint.json"), { overwrite: true });
	generateMintPlaceholder();
	await new Promise((resolve) => setTimeout(resolve, 300));

	// Clear modules
	await emptyDir(DOCS_MODULES_PATH);

	if (abortSignal.aborted) return;

	// Sort modules
	for (let key in meta.modules) {
		if (!meta.modules[key]!.config.name) {
			throw new Error(`Module missing name: ${key}`);
		}
	}
	const modulesSorted = Object.entries(meta.modules)
		.sort((a, b) => a[1].config.name!.localeCompare(b[1].config.name!));

		if (abortSignal.aborted) return;

	// Generate introduction
	await generateModuleCards(modulesSorted);
	if (abortSignal.aborted) return;

	await generateModulesOverview(templates.modulesOverview);
	if (abortSignal.aborted) return;

	console.log("Generating project config");
	await generateProjectConfig(templates);
	if (abortSignal.aborted) return;

	console.log("Generating module config");
	await generateModuleConfig();
	if (abortSignal.aborted) return;

	// Generate modules
	const modulesNav: any = {
		"group": "Modules",
		"pages": [
			"modules/overview",
		],
	};

	for (const [moduleName, module] of modulesSorted) {
		await generateModule(templates, moduleName, module, modulesNav);
		if (abortSignal.aborted) return;
	}

	await generateMintTemplate(modulesNav);

	console.log("Done generating docs!");
}

async function buildDocs(abortSignal: AbortSignal) {
	const meta = await Project.readMeta();
	const templates = await loadTemplates();
	await generate(meta, templates, abortSignal);
}


// MARK: Main
async function watcher(runMintlify: boolean) {
	let controller = new AbortController();
	if (runMintlify) mintlify();

	for await (const _ of readline(Deno.stdin)) {
		controller.abort();
		controller = new AbortController();

		console.log("Rebuilding docs...");
		const signal = controller.signal;
		buildDocs(signal);
	}
}

function mintlify() {
	const command = new Deno.Command(
		"mintlify",
		{
			args: ["dev"],
			cwd: ctx.docsRoot,
			stdout: "inherit",
			stdin: "null",
		}
	).spawn();

	const signalListener = () => {
		command.kill("SIGKILL");
		Deno.removeSignalListener("SIGINT", signalListener);
		Deno.exit();
	}
	Deno.addSignalListener("SIGINT", signalListener);
}

await buildDocs(new AbortController().signal);

if (Deno.args.includes("-w")) watcher(Deno.args.includes("-m"));
