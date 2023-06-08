export function extractPaths(fullPath: string): string[] {
	const paths: string[] = [];
	const sections = fullPath.split('/');

	if (sections.length === 1) return paths;

	if (sections[0]) {
		paths.push(sections[0]);
	}

	sections.slice(1, -1).forEach((section, i) => {
		paths.push(`${paths[i]}/${section}`);
	});

	return paths;
}
