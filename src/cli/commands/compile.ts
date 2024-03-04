import { Command } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { pipeline } from "../../compile/mod.ts";
import { compileSchema } from "../../build/schema.ts";
import { compileScriptHelpers } from "../../build/gen.ts";
import { generateOpenApi } from "../../build/openapi.ts";
import { generateEntrypoint } from "../../build/entrypoint.ts";
import { migrateDev } from "../../migrate/dev.ts";

export const compileCommand = new Command<GlobalOpts>()
  .option("--solemnly-swear", "I solemnly swear that I am up to no good", {
    required: true,
  })
  .option("-w, --watch", "Watch for changes")
  .action(
    async (opts) => {
      if (!opts.solemnlySwear) {
        return;
      }
      const project = await initProject(opts);

      await pipeline.prepare(project);

      const pipelineDef = pipeline({ project }, ({ task }) => {
        const schemaTask = task(
          "schema",
          { input: "modules/*/module.yaml" },
          async () => {
            await compileSchema(project);
          },
        );

        const scriptHelpersTask = task(
          "scriptsHelpers",
          { input: "modules/*/db/*.prisma" },
          async () => {
            await compileScriptHelpers(project);
          },
        );

        const openApiTask = task(
          "openApi",
          { input: ["modules/*/scripts/*.ts", "modules/*/types/*.ts"] },
          async () => {
            await generateOpenApi(project);
          },
          [schemaTask],
        );

        const generateEntrypointTask = task(
          "entrypoint",
          {},
          async () => {
            await generateEntrypoint(project);
          },
          [scriptHelpersTask, openApiTask],
        );

        const migrateTask = task("migrate", {
          input: "modules/*/db/schema.prisma",
        }, async () => {
          await migrateDev(project);
        });

        const main = task("main", {}, () => {
          generateEntrypoint(project);
        }, [generateEntrypointTask, migrateTask]);

        return main;
      });

      if (opts.watch) {
        return pipelineDef.watch();
      }
      return pipelineDef.run();
    },
  );
