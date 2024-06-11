/* tslint:disable */
/* eslint-disable */

export interface ConfigurationParameters {
	endpoint: string; // override base path
	token?: string | Promise<string> | ((name: string) => string | Promise<string>); // parameter for apiKey security
	headers?: HTTPHeaders; //header params we want to use on every request
}

export class Configuration {
	constructor(private configuration: ConfigurationParameters) {}

	get endpoint(): string {
		return this.configuration.endpoint;
	}

	get token(): ((name: string) => string | Promise<string>) | undefined {
		const token = this.configuration.token;
		if (token) {
			return typeof token === "function" ? token : () => token;
		}
		return undefined;
	}

	get headers(): HTTPHeaders | undefined {
		return this.configuration.headers;
	}
}

/**
 * This is the base class for all generated API classes.
 */
export class BaseAPI {
	constructor(protected configuration: Configuration) {
	}

	protected async request(context: RequestOpts, initOverrides?: RequestInit | InitOverrideFunction): Promise<Response> {
		const { url, init } = await this.createFetchParams(context, initOverrides);
		const response = await this.fetchApi(url, init);

		if (response && (response.status >= 200 && response.status < 300)) {
			return response;
		}

		if (!response) throw new RequestError("No response received");

		switch (response.status) {
			case 500:
				throw new InternalError(
					await parseErrorBody(response),
				);
			case 429:
				throw new RateLimitError(
					await parseErrorBody(response),
				);
			case 403:
				throw new ForbiddenError(
					await parseErrorBody(response),
				);
			case 408:
				throw new UnauthorizedError(
					await parseErrorBody(response),
				);
			case 404:
				throw new NotFoundError(
					await parseErrorBody(response),
				);
			case 400:
				throw new BadRequestError(
					await parseErrorBody(response),
				);
			default:
				throw new RequestError(undefined, undefined, await parseErrorBody(response));
		}
	}

	private async createFetchParams(context: RequestOpts, initOverrides?: RequestInit | InitOverrideFunction) {
		const url = this.configuration.endpoint + context.path;

		const headers = Object.assign({}, this.configuration.headers, context.headers);
		Object.keys(headers).forEach((key) => headers[key] === undefined ? delete headers[key] : {});

		const initOverrideFn = typeof initOverrides === "function" ? initOverrides : async () => initOverrides;

		const initParams = {
			method: context.method,
			headers,
			body: context.body,
		};

		const overriddenInit: RequestInit = {
			...initParams,
			...(await initOverrideFn({
				init: initParams,
				context,
			})),
		};

		const body = JSON.stringify(overriddenInit.body);
		const init: RequestInit = {
			...overriddenInit,
			body,
		};

		return { url, init };
	}

	private fetchApi = async (url: string, init: RequestInit) => {
		const fetchParams = { url, init };
		let response: Response | undefined = undefined;
		try {
			response = await fetch(fetchParams.url, fetchParams.init);
		} catch (err) {
			throw new RequestError("Failed to make request", undefined, undefined, { cause: err });
		}
		return response;
	};
}

export class RequestError extends Error {
	constructor(message?: string, readonly statusCode?: number, readonly body?: unknown, options?: ErrorOptions) {
		super(buildMessage(message, statusCode, body), options);
		// Show as `Error`
		Object.setPrototypeOf(this, RequestError.prototype);
	}
}

export class InternalError extends RequestError {
	constructor(body: unknown) {
		super(
			"InternalError",
			500,
			body,
		);
		// Show as `Error`
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

export class RateLimitError extends RequestError {
	constructor(body: unknown) {
		super(
			"RateLimitError",
			429,
			body,
		);
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

export class ForbiddenError extends RequestError {
	constructor(body: unknown) {
		super(
			"ForbiddenError",
			403,
			body,
		);
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

export class UnauthorizedError extends RequestError {
	constructor(body: unknown) {
		super(
			"UnauthorizedError",
			408,
			body,
		);
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

export class NotFoundError extends RequestError {
	constructor(body: unknown) {
		super(
			"NotFoundError",
			404,
			body,
		);
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

export class BadRequestError extends RequestError {
	constructor(body: unknown) {
		super(
			"BadRequestError",
			400,
			body,
		);
		Object.setPrototypeOf(this, ForbiddenError.prototype);
	}
}

function buildMessage(
	message: string | undefined,
	statusCode: number | undefined,
	body: unknown | undefined,
): string {
	const lines: string[] = [];

	if (message != null) {
		lines.push(message);
	}
	if (statusCode != null) {
		lines.push(`Status code: ${statusCode.toString()}`);
	}
	if (body != null) {
		lines.push(`Body: ${JSON.stringify(body, undefined, 2)}`);
	}

	return lines.join("\n");
}

async function parseErrorBody(response: Response) {
	return await response.json();
}

export type FetchAPI = WindowOrWorkerGlobalScope["fetch"];

export type Json = any;
export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type HTTPHeaders = { [key: string]: string };
export type HTTPQuery = {
	[key: string]:
		| string
		| number
		| null
		| boolean
		| Array<string | number | null | boolean>
		| Set<string | number | null | boolean>
		| HTTPQuery;
};
export type HTTPBody = Json | FormData | URLSearchParams;
export type HTTPRequestInit = {
	headers?: HTTPHeaders;
	method: HTTPMethod;
	credentials?: RequestCredentials;
	body?: HTTPBody;
};
export type ModelPropertyNaming = "camelCase" | "snake_case" | "PascalCase" | "original";

export type InitOverrideFunction = (
	requestContext: { init: HTTPRequestInit; context: RequestOpts },
) => Promise<RequestInit>;

export interface FetchParams {
	url: string;
	init: RequestInit;
}

export interface RequestOpts {
	path: string;
	method: HTTPMethod;
	headers: HTTPHeaders;
	query?: HTTPQuery;
	body?: HTTPBody;
}

export function querystring(params: HTTPQuery, prefix: string = ""): string {
	return Object.keys(params)
		.map((key) => querystringSingleKey(key, params[key], prefix))
		.filter((part) => part.length > 0)
		.join("&");
}

function querystringSingleKey(
	key: string,
	value:
		| string
		| number
		| null
		| undefined
		| boolean
		| Array<string | number | null | boolean>
		| Set<string | number | null | boolean>
		| HTTPQuery,
	keyPrefix: string = "",
): string {
	const fullKey = keyPrefix + (keyPrefix.length ? `[${key}]` : key);
	if (value instanceof Array) {
		const multiValue = value.map((singleValue) => encodeURIComponent(String(singleValue)))
			.join(`&${encodeURIComponent(fullKey)}=`);
		return `${encodeURIComponent(fullKey)}=${multiValue}`;
	}
	if (value instanceof Set) {
		const valueAsArray = Array.from(value);
		return querystringSingleKey(key, valueAsArray, keyPrefix);
	}
	if (value instanceof Date) {
		return `${encodeURIComponent(fullKey)}=${encodeURIComponent(value.toISOString())}`;
	}
	if (value instanceof Object) {
		return querystring(value as HTTPQuery, fullKey);
	}
	return `${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`;
}

export function mapValues(data: any, fn: (item: any) => any) {
	return Object.keys(data).reduce(
		(acc, key) => ({ ...acc, [key]: fn(data[key]) }),
		{},
	);
}
