import { move, resolve } from "../deps.ts";
import { CommandError, UnreachableError } from "../error/mod.ts";
import { Project } from "../project/mod.ts";
import { genPath, SDK_PATH } from "../project/project.ts";
import { progress, success } from "../term/status.ts";
import { warn } from "../term/status.ts";
import { generateTypescriptAddons } from "./typescript/mod.ts";

export enum SdkTarget {
	TypeScript,
}

interface Generator {
	generator: string;
	options: Record<string, string>;
}

const GENERATORS: Record<SdkTarget, Generator> = {
	[SdkTarget.TypeScript]: {
		generator: "typescript-fetch",
		options: {
			npmName: "opengb-sdk",
			generateAliasAsModel: "true",
		},
	},
};

export async function generateSdk(
	project: Project,
	target: SdkTarget,
	output: string,
) {
	// Warn if trying to run inside of Docker
	if (Deno.env.has("RUNNING_IN_DOCKER")) {
		warn("Skipping Postgres Dev Server", "Cannot start Postgres dev server when running OpenGB inside of Docker");
		return;
	}

	const targetString = targetToString(target);
	const sdkGenPath = resolve(genPath(project, SDK_PATH), targetString);

	// Clear artifacts
	try {
		await Deno.remove(sdkGenPath, { recursive: true });
	} catch (err) {
		if (!(err instanceof Deno.errors.NotFound)) {
			throw err;
		}
	}

	progress("Building SDK", targetString);

	const config = GENERATORS[target]!;
	const buildOutput = await new Deno.Command("docker", {
		args: [
			"run",
			"--rm",
			"-v",
			`${project.path}:/local`,
			"openapitools/openapi-generator-cli:v7.6.0",
			"generate",
			"-i",
			"/local/.opengb/openapi.json",
			"-g",
			config.generator,
			"-o",
			`/local/.opengb/sdk/${targetString}`,
			"--additional-properties=" + Object.entries(config.options).map(([key, value]) => `${key}=${value}`).join(","),
		],
	}).output();
	if (!buildOutput.success) {
		throw new CommandError("Failed to generate OpenAPI SDK.", { commandOutput: buildOutput });
	}

	if (target == SdkTarget.TypeScript) {
		await generateTypescriptAddons(project, sdkGenPath);
	}

	await move(sdkGenPath, output, { overwrite: true });

	success("Success");
}

function targetToString(target: SdkTarget) {
	if (target == SdkTarget.TypeScript) return "typescript";
	throw new UnreachableError(target);
}
