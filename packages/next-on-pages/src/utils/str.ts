/**
 * Replaces the last instance of a string, in a string.
 *
 * @param contents Contents of the file to replace the last instance in.
 * @param target The target string to replace.
 * @param value The value to replace the target with.
 * @returns The updated contents.
 */
export function replaceLastSubstringInstance(
	contents: string,
	target: string,
	value: string,
): string {
	const lastIndex = contents.lastIndexOf(target);

	if (lastIndex === -1) {
		return contents;
	}

	return (
		contents.slice(0, lastIndex) +
		value +
		contents.slice(lastIndex + target.length)
	);
}
