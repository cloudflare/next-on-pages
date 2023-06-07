import { normalizePath } from './fs';

/**
 * Strip route groups from a path name.
 *
 * The build output config does not rewrite requests to route groups, so we need to strip route
 * groups from the path name for file system matching.
 *
 * Does not strip brackets containing `.` characters, as these are used for route intercepts.
 * https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes
 *
 * @param path Path name to strip route groups from.
 * @returns Path name with route groups stripped.
 */
export function stripRouteGroups(path: string) {
	return path.replace(/\/\(([^).]+)\)/g, '');
}

/**
 * Strip `/index` from a path name.
 *
 * The build output config does not rewrite `/` to `/index`, so we need to strip `/index` from the
 * path name for request matching.
 *
 * @param path Path name to strip `/index` from.
 * @returns Path name with `/index` stripped.
 */
export function stripIndexRoute(path: string) {
	// add leading slash back if it is stripped when `/index` is removed
	return addLeadingSlash(path.replace(/\/index$/, ''));
}

/**
 * Add a leading slash to a path name if it doesn't already have one.
 *
 * Used to ensure that the path name starts with a `/` for matching in the routing system.
 *
 * @param path Path name to add a leading slash to.
 * @returns Path name with a leading slash added.
 */
export function addLeadingSlash(path: string) {
	return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Strip the `.func` extension from a path name.
 *
 * @param path Path name to strip the `.func` extension from.
 * @returns Path name with the `.func` extension stripped.
 */
export function stripFuncExtension(path: string) {
	return path.replace(/\.func$/, '');
}

/**
 * Format a route's path name for matching in the routing system.
 *
 * - Strip the `.func` extension.
 * - Normalize the path name.
 * - Strip route groups (the build output config does not rewrite requests to route groups).
 * - Add a leading slash.
 *
 * @param path Route path name to format.
 * @returns Formatted route path name.
 */
export function formatRoutePath(path: string) {
	return addLeadingSlash(
		stripRouteGroups(addLeadingSlash(normalizePath(stripFuncExtension(path))))
	);
}
