import { resolve } from "../deps.ts";
import { zodOpenApi } from "./deps.ts";
import { Project } from "../project/mod.ts";
import { convertSerializedSchemaToZod } from "./schema/mod.ts";

export async function generateOpenApi(project: Project) {
	const paths: zodOpenApi.ZodOpenApiPathsObject = {};

	for (const mod of project.modules.values()) {
		for (const script of mod.scripts.values()) {
			paths[`/modules/${mod.name}/scripts/${script.name}/call`] = {
				post: {
					description: `Call ${mod.name}.${script.name} script.`,
					tags: ["Backend", mod.name],
					operationId: `call_${mod.name}_${script.name}`,
					requestBody: {
						content: {
							"application/json": {
								schema: convertSerializedSchemaToZod(script.schemas?.request!),
							},
						},
					},
					responses: {
						"200": {
							description: "Success",
							content: {
								"application/json": {
									schema: convertSerializedSchemaToZod(
										script.schemas?.response!,
									),
								},
							},
						},
					},
				},
			};
		}
	}

	const document = zodOpenApi.createDocument({
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
		paths,
	});

	await Deno.writeTextFile(
		resolve(project.path, "_gen", "openapi.json"),
		JSON.stringify(document, null, 4),
	);
}
