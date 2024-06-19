export {
	dirname,
	format as formatPath,
	fromFileUrl,
	isAbsolute,
	parse as parsePath,
	relative,
	resolve,
	SEP,
} from "https://deno.land/std@0.208.0/path/mod.ts";
export { copy, emptyDir, exists, move } from "https://deno.land/std@0.208.0/fs/mod.ts";
export { assert, assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

export * as tjs from "npm:typescript-json-schema@0.62.0";

import Ajv from "https://esm.sh/ajv@^8.12.0";
export { Ajv };

import addFormats from "https://esm.sh/ajv-formats@^2.1.1";
export { addFormats };

// Must match version in `esbuild_deno_loader`
//
// See also Prisma esbuild in `src/migrate/deps.ts`
export * as esbuild from "https://deno.land/x/esbuild@v0.20.2/mod.js";
export { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.10.3";

export * as glob from "https://esm.sh/glob@^10.3.10";
