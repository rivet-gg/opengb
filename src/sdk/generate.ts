import { move } from "../deps.ts";
import { CommandError } from "../error/mod.ts";
import { Project } from "../project/mod.ts";

export enum SdkTarget {
	TypeScript,
}

interface Generator {
	generator: string;
	options: Record<string, string>;
}

const GENERATORS: Record<SdkTarget, Generator> = {
	[SdkTarget.TypeScript]: {
		generator: "typescript",
		options: {
			npmName: "opengb-sdk",
		},
	},
};

export async function generateSdk(
	project: Project,
	target: SdkTarget,
	output: string,
) {
	const config = GENERATORS[target]!;

	const buildOutput = await new Deno.Command("docker", {
		args: [
			"run",
			"--rm",
			"-v",
			`${project.path}:/local`,
			"openapitools/openapi-generator-cli:v7.2.0",
			"generate",
			"-i",
			"/local/_gen/openapi.json",
			"-g",
			config.generator,
			"-o",
			`/local/_gen/sdk/`,
			...Object.entries(config.options).map(([key, value]) => `--additional-properties=${key}=${value}`),
		],
	}).output();
	if (!buildOutput.success) {
		throw new CommandError("Failed to generate OpenAPI SDK.", { commandOutput: buildOutput });
	}

	await move(`${project.path}/_gen/sdk`, output, { overwrite: true });
}
