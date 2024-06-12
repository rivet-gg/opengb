export function camelify(snake: string) {
	const partial = snake.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
	return partial[0].toLowerCase() + partial.slice(1);
}

export function pascalify(snake: string) {
	const camel = camelify(snake);
	return camel[0].toUpperCase() + camel.slice(1);
}

export function snakeify(camel: string) {
	return camel.replace(/[A-Z]/g, (g) => `_${g.toLowerCase()}`);
}
