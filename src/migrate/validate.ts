import { InternalError } from "../error/mod.ts";

/** Validate alphanumeric characters */
export function validateString(input: string): boolean {
	const regex = /^[a-zA-Z0-9_]+$/;
	return regex.test(input);
}

export function assertValidString(input: string): string {
	if (!validateString(input)) {
		throw new InternalError(`Invalid SQL identifier: ${input}`);
	}
	return input;
}
