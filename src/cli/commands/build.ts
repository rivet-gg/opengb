import { Command, ValidationError } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { build, DbDriver, Format, Runtime } from "../../build/mod.ts";
import { watch } from "../../watch/mod.ts";
import { Project } from "../../project/mod.ts";

export const buildCommand = new Command<GlobalOpts>()
	.description("Build the project")
	.option("--watch", "Automatically rebuid on changes", { default: false })
	.option(
		"-r, --runtime <runtime:string>",
		"Set target runtime (deno, cloudflare)",
		{
			default: "deno",
			value: (value: string) => {
				if (value == "deno") {
					return Runtime.Deno;
				} else if (value == "cloudflare" || value == "cf") {
					return Runtime.Cloudflare;
				} else {
					throw new ValidationError(
						`\`runtime\` must be one of "deno", "cloudflare", or "cf", but got "${value}".`,
					);
				}
			},
		},
	)
	.option(
		"-f, --output-format <format:string>",
		"Set output format (native, bundled)",
		{
			// default: "native",
			value: (value: string) => {
				if (value == "native") {
					return Format.Native;
				} else if (value == "bundled") {
					return Format.Bundled;
				} else {
					throw new ValidationError(
						`\`output-format\` format must be one of "native", or "bundled" but got "${value}".`,
					);
				}
			},
		},
	)
	.option(
		"--db-driver <target:string>",
		"Set target runtime (node-postgres, neon-serverless)",
		{
			// default: "node-postgres",
			value: (value: string) => {
				if (value == "node-postgres") {
					return DbDriver.NodePostgres;
				} else if (value == "neon-serverless") {
					return DbDriver.NeonServerless;
				} else {
					throw new ValidationError(
						`\`db-driver\` must be one of "node-postgres", or "neon-serverless", but got "${value}".`,
					);
				}
			},
		},
	)
	.action(async (opts) => {
		const project = await initProject(opts);

		// Defaults based on runtime
		if (opts.runtime == Runtime.Deno) {
			if (opts.outputFormat == undefined) opts.outputFormat = Format.Native;
			if (opts.dbDriver == undefined) opts.dbDriver = DbDriver.NodePostgres;
		} else if (opts.runtime == Runtime.Cloudflare) {
			if (opts.outputFormat == undefined) opts.outputFormat = Format.Bundled;
			if (opts.dbDriver == undefined) opts.dbDriver = DbDriver.NeonServerless;
		}

		// Validate
		if (opts.runtime == Runtime.Cloudflare) {
			if (opts.outputFormat != Format.Bundled) {
				throw new ValidationError(
					`\`format\` must be "bundled" if \`runtime\` is "cloudflare".`,
				);
			}
			if (opts.dbDriver != DbDriver.NeonServerless) {
				throw new ValidationError(
					`\`db-driver\` must be "neon-serverless" if \`runtime\` is "cloudflare".`,
				);
			}
		}
		if (opts.runtime == Runtime.Deno) {
			if (opts.outputFormat != Format.Native) {
				throw new ValidationError(
					`\`format\` must be "native" if \`runtime\` is "deno".`,
				);
			}
		}

		await watch(project, {
			disableWatch: !opts.watch,
			async fn(project: Project) {
				await build(project, {
					format: opts.outputFormat!,
					runtime: opts.runtime,
					dbDriver: opts.dbDriver!,
				});
			},
		});
	});
