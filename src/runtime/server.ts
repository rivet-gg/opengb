import { Runtime } from "./runtime.ts";

const MODULE_CALL =
	/^\/modules\/(?<module>\w+)\/scripts\/(?<script>\w+)\/call\/?$/;

export function serverHandler<RegistryT, RegistryCamelT>(
	runtime: Runtime<RegistryT, RegistryCamelT>,
): Deno.ServeHandler {
	return async (
		req: Request,
		info: Deno.ServeHandlerInfo,
	): Promise<Response> => {
		const url = new URL(req.url);

		const matches = MODULE_CALL.exec(url.pathname);
		if (req.method == "POST" && matches?.groups) {
			// Lookup script
			const moduleName = matches.groups.module;
			const scriptName = matches.groups.script;
			const script = runtime.config.modules[moduleName]?.scripts[scriptName];

			if (script?.public) {
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
					const output = {
						message: "Request must have a valid JSON body.",
					};
					return new Response(JSON.stringify(output), {
						status: 400,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				}

				try {
					// Call module
					const output = await ctx.call(
						moduleName as any,
						scriptName as any,
						body,
					);

					if (output.__tempPleaseSeeOGBE3_NoData) {
						return new Response(undefined, {
							status: 204,
							headers: {
								"Access-Control-Allow-Origin": "*",
							},
						});
					}

					return new Response(JSON.stringify(output), {
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				} catch (e) {
					// Error response
					const output = {
						message: e.message,
					};

					return new Response(JSON.stringify(output), {
						status: 500,
						headers: {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				}
			}
		}

		// Not found response
		return new Response(
			JSON.stringify({
				"message": "Route not found. Make sure the URL and method are correct.",
			}),
			{
				headers: {
					"Content-Type": "application/json",
				},
				status: 404,
			},
		);
	};
}
