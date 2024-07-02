import { resolve } from "../deps.ts";
import { Module } from "./module.ts";
import { Project } from "./project.ts";
import { ActorConfig } from "../config/module.ts";

export interface Actor {
	path: string;
	name: string;
	storageAlias: string;
	config: ActorConfig;
}

export function actorGenPath(
	_project: Project,
	module: Module,
	actor: Actor,
): string {
	return resolve(
		module.path,
		"_gen",
		"actors",
		actor.name + ".ts",
	);
}
