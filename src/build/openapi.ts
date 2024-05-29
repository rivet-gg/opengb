import { resolve } from "../deps.ts";
import { tjs } from "./deps.ts";
import { Project } from "../project/mod.ts";
import { genPath, OPEN_API_PATH } from "../project/project.ts";

// deno-lint-ignore no-explicit-any
type OpenApiDefinition = any;

export async function generateOpenApi(project: Project) {
	const schema: OpenApiDefinition = {
		openapi: "3.1.0",
		info: {
			title: "Open Game Backend",
			version: "1.0.0",
		},
		servers: [
			{
				"description": "Local",
				"url": "http://localhost:8080",
			},
		],
		tags: [
			{
				name: "Open Game Backend",
				description: "Open Game Backend",
			},
		],
		paths: {} as Record<string, OpenApiDefinition>,
		components: {
			schemas: {},
		},
	};

	for (const mod of project.modules.values()) {
		for (const script of mod.scripts.values()) {
			const requestBodyRef = injectSchema(
				schema,
				script.requestSchema!,
				`${mod.name}__${script.name}__request`,
				"Request",
			);
			const responseContentRef = injectSchema(
				schema,
				script.responseSchema!,
				`${mod.name}__${script.name}__response`,
				"Response",
			);
			schema.paths[`/modules/${mod.name}/scripts/${script.name}/call`] = {
				post: {
					description: `Call ${mod.name}.${script.name} script.`,
					tags: ["Backend"],
					operationId: `call_${mod.name}_${script.name}`,
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: requestBodyRef },
							},
						},
					},
					responses: {
						"200": {
							description: "Success",
							content: {
								"application/json": {
									schema: { $ref: responseContentRef },
								},
							},
						},
					},
				},
			};
		}
	}

	await Deno.writeTextFile(
		genPath(project, OPEN_API_PATH),
		JSON.stringify(schema, null, 4),
	);
}

/**
 * Injects a JSON schema in to an OpenAPI schema and returns the reference to the new location.
 *
 * @param openapi The OpenAPI schema to inject the JSON schema in to
 * @param schema The JSON schema to inject
 * @param prefix The prefix to add to the schema names
 * @param rootDefinition The name of the root definition in the JSON schema
 */
function injectSchema(
	openapi: OpenApiDefinition,
	schema: tjs.Definition,
	prefix: string,
	rootDefinition: string,
) {
	schema = structuredClone(schema);

	// Add the root definition to the OpenAPI schema
	replaceRefs(
		schema,
		(ref) => ref.replace("#/definitions/", `#/components/schemas/${prefix}__`),
	);
	openapi.components.schemas[`${prefix}__${rootDefinition}`] = schema;

	// Add the definition to the OpenAPI schema and remove it from the JSON schema
	for (const definitionName in schema.definitions) {
		const definition = schema.definitions[definitionName];

		// Add the definition to the OpenAPI schema
		replaceRefs(
			definition,
			(ref) => ref.replace("#/definitions/", `#/components/schemas/${prefix}__`),
		);
		openapi.components.schemas[`${prefix}__${definitionName}`] = definition;
	}
	delete schema.definitions;

	return `#/components/schemas/${prefix}__${rootDefinition}`;
}

/**
 * Recursively replace $ref properties in an object
 */
function replaceRefs(obj: OpenApiDefinition, replacer: (x: string) => string) {
	for (const key in obj) {
		if (key === "$ref") {
			obj[key] = replacer(obj[key]);
		} else if (typeof obj[key] === "object") {
			replaceRefs(obj[key], replacer);
		} else if (Array.isArray(obj[key])) {
			for (const item of obj[key]) {
				replaceRefs(item, replacer);
			}
		}
	}
}
