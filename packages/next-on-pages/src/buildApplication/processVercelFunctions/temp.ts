// temporary file during development

export const timer = (name: string) => {
	const start = Date.now();
	// eslint-disable-next-line no-console
	return { stop: () => console.log(`${name}: ${Date.now() - start}ms`) };
};
