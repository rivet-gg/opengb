// Runs synchronise TypeScript code to derive the schema from a script in a
// background worker.

/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import { tjs } from "./deps.ts";
import { configPath, Module } from "../project/module.ts";
import { InternalError } from "../error/mod.ts";

export interface WorkerRequest {
	module: Module;
}

export interface WorkerResponse {
	moduleConfigSchema: tjs.Definition;
}

self.onmessage = async (ev) => {
	const { module } = ev.data as WorkerRequest;
	const moduleConfigPath = configPath(module);

	// TODO: Dupe of project.ts
	// https://docs.deno.com/runtime/manual/advanced/typescript/configuration#what-an-implied-tsconfigjson-looks-like
	const DEFAULT_COMPILER_OPTIONS = {
		"allowJs": true,
		"esModuleInterop": true,
		"experimentalDecorators": false,
		"inlineSourceMap": true,
		"isolatedModules": true,
		"jsx": "react",
		"module": "esnext",
		"moduleDetection": "force",
		"strict": true,
		"target": "esnext",
		"useDefineForClassFields": true,

		"lib": ["esnext", "dom", "dom.iterable"],
		"allowImportingTsExtensions": true,
	};

	const validateConfig = {
		topRef: true,
		required: true,
		strictNullChecks: true,
		noExtraProps: true,
		esModuleInterop: true,

		// TODO: Is this needed?
		include: [moduleConfigPath],

		// TODO: Figure out how to work without this? Maybe we manually validate the request type exists?
		ignoreErrors: true,
	};

	const program = tjs.getProgramFromFiles(
		[moduleConfigPath],
		DEFAULT_COMPILER_OPTIONS,
	);

	const moduleConfigSchema = tjs.generateSchema(
		program,
		"Config",
		validateConfig,
		[moduleConfigPath],
	);
	if (moduleConfigSchema === null) {
		throw new InternalError("Failed to generate config schema.", { path: moduleConfigPath });
	}

	self.postMessage({
		moduleConfigSchema,
	} as WorkerResponse);
};
