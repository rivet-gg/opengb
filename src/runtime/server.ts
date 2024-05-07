import { Route, Script } from "./mod.ts";
import { Runtime } from "./runtime.ts";
import { PathResolver } from "./path_resolver.ts";
import { badBodyResponse, notFoundResponse, serverOrRuntimeError } from "./responses.ts";

const MODULE_CALL = /^\/modules\/(?<module>\w+)\/scripts\/(?<script>\w+)\/call\/?$/;

export async function handleScriptCall<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT>(
	runtime: Runtime<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT>,
	url: URL,
	moduleName: string,
	scriptName: string,
	script: Script,
	req: Request,
	info: Deno.ServeHandlerInfo,
) {
	// If a script is not public, return 404
	if (!script.public) return notFoundResponse();

	// Create context
	const ctx = runtime.createRootContext({
		httpRequest: {
			method: req.method,
			path: url.pathname,
			remoteAddress: info.remoteAddr.hostname,
			headers: Object.fromEntries(req.headers.entries()),
		},
	});

	// Parse body
	let body;
	try {
		body = await req.json();
	} catch {
		return badBodyResponse();
	}

	let output: any;
	try {
		// Call module
		output = await ctx.call(
			moduleName as any,
			scriptName as any,
			body,
		);
	} catch (e) {
		return serverOrRuntimeError(e);
	}

	return new Response(
		JSON.stringify(output),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		},
	);
}

export async function handleRouteCall<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT>(
	runtime: Runtime<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT>,
	url: URL,
	moduleName: string,
	routeName: string,
	route: Route,
	req: Request,
	info: Deno.ServeHandlerInfo,
) {
	if (!route.methods.has(req.method)) notFoundResponse();

	// Create context
	const ctx = runtime.createRootRouteContext(
		{
			httpRequest: {
				method: req.method,
				path: url.pathname,
				remoteAddress: info.remoteAddr.hostname,
				headers: Object.fromEntries(req.headers.entries()),
			},
		},
		moduleName,
		routeName,
	);

	// Call route
	const res = await ctx.runBlock(async () => await route.run(ctx, req));
	console.log(
		`Route Response ${moduleName}.${routeName}:\n${JSON.stringify(res, null, 2)}`,
	);

	return res;
}

export function serverHandler<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT>(
	runtime: Runtime<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT>,
): Deno.ServeHandler {
	const resolver = new PathResolver(runtime.routePaths());

	return async (
		req: Request,
		info: Deno.ServeHandlerInfo,
	): Promise<Response> => {
		const url = new URL(req.url);

		// Handle CORS preflight
		if (req.method === "OPTIONS") {
			return runtime.corsPreflight(req);
		}

		// Disallow even simple requests if CORS is not allowed
		if (!runtime.corsAllowed(req)) {
			return new Response(undefined, {
				status: 403,
				headers: {
					"Vary": "Origin",
					...runtime.corsHeaders(req),
				},
			});
		}

		// Normal script call
		const matches = MODULE_CALL.exec(url.pathname);
		if (matches?.groups) {
			// Only allow POST requests
			if (req.method !== "POST") {
				return new Response(undefined, {
					status: 405,
					headers: {
						"Allow": "POST",
						...runtime.corsHeaders(req),
					},
				});
			}

			// Lookup script
			const moduleName = matches.groups.module;
			const scriptName = matches.groups.script;
			const script = runtime.config.modules[moduleName]?.scripts[scriptName];
			if (!script) return notFoundResponse();

			return handleScriptCall(runtime, url, moduleName, scriptName, script, req, info);
		}

		// Route call
		const resolved = resolver.resolve(url.pathname);
		if (!resolved) return notFoundResponse();

		const { module, route } = resolved;

		const routeObj = runtime.config.modules[module]?.routes?.[route];
		if (!routeObj) return notFoundResponse();

		return handleRouteCall(runtime, url, module, route, routeObj, req, info);
	};
}
