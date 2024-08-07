import { resolve } from "./deps.ts";

const WEB_REPO_PATH = resolve(import.meta.dirname!, "..", "..", "vendor", "hub");

await new Deno.Command("yarn", {
    cwd: WEB_REPO_PATH,
    env: {
        "NODE_ENV": "production",
    },
    stdout: "inherit",
    stderr: "inherit",
}).output();

await new Deno.Command("yarn", {
    args: [
        "build:opengb",
    ],
    cwd: WEB_REPO_PATH,
    env: {
        "NODE_ENV": "production",
        "TURBO_UI": "0",
        "VITE_OUT_DIR": resolve(import.meta.dirname!, "..", "..", "artifacts", "web"),
    },
    stdout: "inherit",
    stderr: "inherit",
}).output();
