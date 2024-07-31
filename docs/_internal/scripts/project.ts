#!/usr/bin/env deno run -A

import { resolve } from "https://deno.land/std@0.214.0/path/mod.ts";
import { assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ProjectMeta } from "../../../packages/toolchain/src/build/meta.ts";
import { ctx } from "./generate.ts";


export async function buildOpenGB() {
	console.log("Build OpenGB CLI");
	const installOutput = await new Deno.Command("deno", {
		args: ["task", "artifacts:build"],
		cwd: ctx.openGBRoot,
		stdout: "inherit",
		stderr: "inherit",
	}).output();
	assert(installOutput.success);
}

export async function buildProject() {
	console.log("Building project");
	const buildOutput = await new Deno.Command("deno", {
		args: [
			"run",
			"-A",
			resolve(ctx.openGBRoot, "packages", "cli", "src", "main.ts"),
			"--path",
			ctx.testProjectPath,
			"build",
		],
		stdout: "inherit",
		stderr: "inherit",
	}).output();
	assert(buildOutput.success);
}

export async function readMeta(): Promise<ProjectMeta> {
	console.log("Reading meta");
	const metaRaw = await Deno.readTextFile(
		resolve(ctx.testProjectPath, ".opengb", "meta.json"),
	);
	return JSON.parse(metaRaw) as ProjectMeta;
}
