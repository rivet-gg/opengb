import { pascalify } from "../../types/case_conversions.ts";
import { dirname, resolve } from "../../deps.ts";
import { GeneratedCodeBuilder, Lang } from "../../build/gen/code_builder.ts";
import { Project } from "../../project/mod.ts";
import dynamicArchive from "../../../artifacts/dynamic_archive.json" with { type: "json" };
import { dedent } from "../../build/deps.ts";
import { autoGenHeader } from "../../build/misc.ts";

// https://docs.godotengine.org/en/stable/classes/class_object.html#class-object
const RESERVED_WORDS = [
	"get",
	"set",
	"to_string",
	"notification",
	"free",
	"connect",
	"disconnect",
	"init",
	"_get",
	"_set",
	"_init",
];

export async function generateGodot(project: Project, sdkGenPath: string) {
	await copyBase(sdkGenPath);
	await generateApiClient(project, sdkGenPath);
}

export async function copyBase(sdkGenPath: string) {
	for (const key in dynamicArchive) {
		if (!key.startsWith("sdk/godot/")) continue;

		// "sdk/godot/".length = 10
		const path = resolve(sdkGenPath, key.slice(10));

		// Create dir for module apis
		try {
			await Deno.mkdir(dirname(path), { recursive: true });
		} catch (e) {
			if (!(e instanceof Deno.errors.AlreadyExists)) {
				throw e;
			}
		}

		const content = autoGenHeader("#") + "\n\n" + (dynamicArchive as Record<string, string>)[key];
		await Deno.writeTextFile(path, content);
	}

	// Create dirs for apis
	try {
		await Deno.mkdir(resolve(sdkGenPath, "api", "modules"), { recursive: true });
	} catch (e) {
		if (!(e instanceof Deno.errors.AlreadyExists)) {
			throw e;
		}
	}
}

export async function generateApiClient(project: Project, sdkGenPath: string) {
	const apiBuilder = new GeneratedCodeBuilder(resolve(sdkGenPath, "api", "backend.gd"), 2, Lang.GDScript);

	apiBuilder.append`
		extends ApiClient
		class_name Backend
	`;

	const imports = apiBuilder.chunk;
	const properties = apiBuilder.chunk;
	const modules = apiBuilder.chunk;

	for (const mod of project.modules.values()) {
		const moduleNamePascal = pascalify(mod.name);

		// Create module api class
		const moduleApiBuilder = new GeneratedCodeBuilder(
			resolve(sdkGenPath, "api", "modules", `${mod.name}.gd`),
			2,
			Lang.GDScript,
		);

		moduleApiBuilder.append`
			extends ApiClient
			class_name ${moduleNamePascal}

			const _ApiResponse := preload("../../client/response.gd")
		`;

		const scripts = moduleApiBuilder.chunk;
		const scriptNames = Array.from(mod.scripts.keys());
		const escapedScriptNames = escapeReservedWords(scriptNames);

		for (let i = 0, l = scriptNames.length; i < l; i++) {
			const escapedScriptName = escapedScriptNames[i];
			const script = mod.scripts.get(scriptNames[i])!;
			const path = `/modules/${mod.name}/scripts/${script.name}/call`;

			scripts.append`
				func ${escapedScriptName}(body: Dictionary = {}) -> _ApiResponse:
					return await self._request(HTTPClient.METHOD_POST, "${path}", body).wait_completed()
			`;
		}
		await moduleApiBuilder.write();

		// Add module to main api class
		imports.append`const _${moduleNamePascal} := preload("modules/${mod.name}.gd")`;
		properties.append`var ${mod.name}: _${moduleNamePascal}`;
		// TODO: Make prettier (needs tab alignment with the below `func _init` block)
		modules.appendRaw(
			`\tself.${mod.name} = _${moduleNamePascal}.new(self.configuration)\n\tself.add_child(self.${mod.name})`,
		);
	}

	GeneratedCodeBuilder.wrap(
		dedent`
			func _init(configuration: Configuration):
				super(configuration)
		`,
		modules,
		"",
	);

	await apiBuilder.write();
}

function escapeReservedWords(wordsList: string[]) {
	let escaped = [];
	let usedNames = new Set();

	for (let i = 0; i < wordsList.length; i++) {
		let word = wordsList[i];

		while (RESERVED_WORDS.includes(word) || usedNames.has(word)) {
			word = "call_" + word;
		}

		usedNames.add(word);
		escaped[i] = word;
	}

	return escaped;
}
