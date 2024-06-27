import { RuntimeError } from "./mod.ts";

/**
 * Builds a response indicating that the route was not found.
 *
 * Essentially a 404.
 *
 * This is used both in route calls and script calls.
 *
 * @returns A response indicating that the route was not found at the requested
 * URL.
 */
export function notFoundResponse(): Response {
	return new Response(
		JSON.stringify({
			message: "Route not found. Make sure the URL and method are correct.",
		}),
		{
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			status: 404,
		},
	);
}

/**
 * Builds a response indicating that although the route was found, the request
 * body (JSON) was invalid or did not validate.
 *
 * Used only in script calls.
 *
 * @returns A response indicating that the request body was invalid for the
 * script called.
 */
export function badBodyResponse(): Response {
	return new Response(
		JSON.stringify({
			message: "Request must have a valid JSON body.",
		}),
		{
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			status: 400,
		},
	);
}

/**
 * Builds a response from an unknown `e`, handling both the case where `e` is a
 * {@linkcode RuntimeError} and the case where it is not.
 *
 * @param e The (maybe {@linkcode RuntimeError}) error to be converted into a
 * response
 * @returns A response indicating that an unknown error occurred in the server
 * OR that a {@linkcode RuntimeError} occurred.
 */
export function serverOrRuntimeError(e: unknown): Response {
	const status = e instanceof RuntimeError ? e.statusCode : 500;
	return new Response(
		JSON.stringify({
			message: e,
		}),
		{
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			status,
		},
	);
}
