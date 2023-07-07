import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readdir, readFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

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
export async function validateFile(path: string) {
	return validatePathType(path, 'file');
}

/**
 * Check that the path exists and that it is a directory.
 *
 * @param path Path to check.
 * @returns Whether a directory exists at the given path.
 */
export async function validateDir(path: string) {
	return validatePathType(path, 'directory');
}

/**
 * Recursively reads all file paths in a directory.
 *
 * @param dir Directory to recursively read from.
 * @returns Array of all paths for all files in a directory.
 */
export async function readPathsRecursively(dir: string): Promise<string[]> {
	try {
		const files = await readdir(dir);

		const paths = await Promise.all(
			files.map(async file => {
				const path = resolve(dir, file);

				return (await validateDir(path)) ? readPathsRecursively(path) : [path];
			}),
		);

		return paths.flat();
	} catch {
		return [];
	}
}

/**
 * Copies a file from one location to another, it also creates the destination
 * directory if it doesn't exist
 *
 * @param sourceFile Original file path.
 * @param destFile Destination for the file.
 */
export async function copyFileWithDir(sourceFile: string, destFile: string) {
	await mkdir(dirname(destFile), { recursive: true });
	await copyFile(sourceFile, destFile);
}

/**
 * Reads all directories in a directory.
 *
 * @param path Path to read directories from.
 * @returns Array of all directories in a directory.
 */
export async function readDirectories(
	basePath: string
): Promise<DirectoryInfo[]> {
	try {
		const files = await readdir(basePath, { withFileTypes: true });

		const dirs = await Promise.all(
			files.map(async file => {
				const path = normalizePath(join(basePath, file.name));
				const isSymbolicLink = file.isSymbolicLink();
				const isDirectory =
					file.isDirectory() || (isSymbolicLink && (await validateDir(path)));

				return { name: file.name, path, isDirectory, isSymbolicLink };
			})
		);

		return dirs.filter(file => file.isDirectory);
	} catch {
		return [];
	}
}

type DirectoryInfo = {
	name: string;
	path: string;
	isDirectory: boolean;
	isSymbolicLink: boolean;
};

/**
 * Retrieves the hash for a file.
 *
 * @param path File path.
 * @returns The file's hash, or undefined if the file does not exist.
 */
export function getFileHash(path: string): Buffer | undefined {
	try {
		const file = readFileSync(path);
		return createHash('sha256').update(file).digest();
	} catch (e) {
		return undefined;
	}
}
