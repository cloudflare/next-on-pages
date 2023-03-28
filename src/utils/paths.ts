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
