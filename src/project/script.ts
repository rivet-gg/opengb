import { resolve } from "../deps.ts";
import { tjs } from "./deps.ts";
import { Module } from "./module.ts";
import { ScriptConfig } from "../config/module.ts";
import { Project } from "./project.ts";
import { AnySchemaElement } from "../build/schema/mod.ts";

export interface Script {
	path: string;
	name: string;
	config: ScriptConfig;

	/**
	 * @deprecated
	 */
	requestSchema?: tjs.Definition;
	/**
	 * @deprecated
	 */
	responseSchema?: tjs.Definition;

	schemas?: {
		request: AnySchemaElement;
		response: AnySchemaElement;
	};
}

export function scriptGenPath(
	_project: Project,
	module: Module,
	script: Script,
): string {
	return resolve(
		module.path,
		"_gen",
		"scripts",
		script.name + ".ts",
	);
}
