import { readdir, readFile, stat } from 'fs/promises';
import { resolve } from 'path';

/**
 * Convert paths with backslashes to normalized paths with forward slashes.
 *
 * Extended-length paths on Windows (starting with \\\\?\\) are not normalized due to
 * exceeding the MAX_PATH (260 characters). They need this prefix so that Windows can
 * identify them as an extended-length path.
 *
 * This is useful when building a project on Windows as the path names in the Next.js
 * build output middleware manifest are in the forward slash format, while Windows
 * uses backslashes.
 *
 * @param path A path with backslashes.
 * @returns A path with forward slashes.
 *
 * @example
 * ```ts
 * const normalized = normalizePath("D:\\path\\with\\backslashes");
 * // normalized === "D:/path/with/backslashes"
 * ```
 */
export function normalizePath(path: string) {
	return path.startsWith('\\\\?\\') ? path : path.replace(/\\/g, '/');
}

type JSONValue =
	| string
	| number
	| boolean
	| null
	| { [key: string]: JSONValue }
	| JSONValue[];

/**
 * Read and parse a JSON file.
 *
 * @param path File path to try and parse as JSON.
 * @returns Parsed JSON file.
 */
export async function readJsonFile<T extends JSONValue>(path: string) {
	let parsed: T | null = null;
	try {
		const contents = await readFile(path, 'utf8');
		parsed = JSON.parse(contents) as T;
	} catch (e) {
		parsed = null;
	}

	return parsed;
}

/**
 * Check that the path exists and is of the expected type.
 *
 * @param path Path to check.
 * @param type Whether to check for a `file` or `directory`.
 * @returns Boolean representing whether the path matched the expected type.
 */
async function validatePathType(path: string, type: 'file' | 'directory') {
	try {
		const stats = await stat(path);
		if (type === 'file' && stats.isFile()) return true;
		if (type === 'directory' && stats.isDirectory()) return true;
	} catch (e) {
		/* empty */
	}

	return false;
}

/**
 * Check that the path exists and that it is a file.
 *
 * @param path Path to check.
 * @returns Whether a file exists at the given path.
 */
export function validateFile(path: string) {
	return validatePathType(path, 'file');
}

/**
 * Check that the path exists and that it is a directory.
 *
 * @param path Path to check.
 * @returns Whether a directory exists at the given path.
 */
export function validateDir(path: string) {
	return validatePathType(path, 'directory');
}

/**
 * Recursively reads all file paths in a directory.
 *
 * @param dir Directory to recursively read from.
 * @returns Array of all paths for all files in a directory.
 */
export async function readPathsRecursively(dir: string): Promise<string[]> {
	const files = await readdir(dir);

	const paths = await Promise.all(
		files.map(async file => {
			const path = resolve(dir, file);

			return (await validateDir(path))
				? await readPathsRecursively(path)
				: [path];
		})
	);

	return paths.flat();
}
