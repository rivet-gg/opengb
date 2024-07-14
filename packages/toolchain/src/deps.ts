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

export { fromError as fromValidationError, isZodErrorLike as isValidationError } from "npm:zod-validation-error@3.3.0";

// Must match version in `esbuild_deno_loader`
//
// See also Prisma esbuild in `src/migrate/deps.ts`
export * as esbuild from "https://deno.land/x/esbuild@v0.20.2/mod.js";
export { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.10.3";

export * as glob from "https://esm.sh/glob@^10.3.10";
export * as encoding from "jsr:@std/encoding/base64";
