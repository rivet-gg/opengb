// Runs synchronise TypeScript code to derive the schema from a script in a
// background worker.

/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import { tjs } from "./deps.ts";
import { Script } from "../project/mod.ts";
import { InternalError } from "../error/mod.ts";

export interface WorkerRequest {
	script: Script;
}

export interface WorkerResponse {
	requestSchema: tjs.Definition;
	responseSchema: tjs.Definition;
}

self.onmessage = async (ev) => {
	const { script } = ev.data as WorkerRequest;

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
		include: [script.path],

		// TODO: Figure out how to work without this? Maybe we manually validate the request type exists?
		ignoreErrors: true,
	};

	const program = tjs.getProgramFromFiles(
		[script.path],
		DEFAULT_COMPILER_OPTIONS,
	);

	const requestSchema = tjs.generateSchema(
		program,
		"Request",
		validateConfig,
		[script.path],
	);
	if (requestSchema === null) {
		throw new InternalError("Failed to generate request schema.", { path: script.path });
	}

	const responseSchema = tjs.generateSchema(
		program,
		"Response",
		validateConfig,
		[script.path],
	);
	if (responseSchema === null) {
		throw new InternalError(
			"Failed to generate response schema.",
			{ path: script.path },
		);
	}

	self.postMessage({
		requestSchema,
		responseSchema,
	} as WorkerResponse);
};
