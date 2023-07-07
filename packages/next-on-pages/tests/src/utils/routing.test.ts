import { describe, test, expect } from 'vitest';
import {
	addLeadingSlash,
	formatRoutePath,
	getRouteOverrides,
	stripFuncExtension,
	stripIndexRoute,
	stripRouteGroups,
} from '../../../src/utils';

describe('routing', () => {
	test('stripRouteGroups', () => {
		expect(stripRouteGroups('/path/name')).toEqual('/path/name');
		expect(stripRouteGroups('/path/(route-group)/name')).toEqual('/path/name');
		expect(stripRouteGroups('/(route-group)/path')).toEqual('/path');
	});

	test('stripRouteGroups does not strip intercepts', () => {
		expect(stripRouteGroups('/(.)intercept')).toEqual('/(.)intercept');
		expect(stripRouteGroups('/(..)(..)intercept')).toEqual(
			'/(..)(..)intercept',
		);
	});

	test('stripIndexRoute', () => {
		expect(stripIndexRoute('/index')).toEqual('/');
		expect(stripIndexRoute('/path/index')).toEqual('/path');
		expect(stripIndexRoute('/path')).toEqual('/path');
	});

	test('addLeadingSlash', () => {
		expect(addLeadingSlash('path')).toEqual('/path');
		expect(addLeadingSlash('/path')).toEqual('/path');
	});

	test('stripFuncExtension', () => {
		expect(stripFuncExtension('path')).toEqual('path');
		expect(stripFuncExtension('path.func')).toEqual('path');
		expect(stripFuncExtension('path/name.func')).toEqual('path/name');
	});

	test('formatRoutePath', () => {
		expect(formatRoutePath('\\path')).toEqual('/path');
		expect(formatRoutePath('path')).toEqual('/path');
		expect(formatRoutePath('/(group)/path')).toEqual('/path');
		expect(formatRoutePath('/path.func')).toEqual('/path');
	});

	test('getRouteOverrides', () => {
		expect(getRouteOverrides('/index')).toEqual(['/']);
		expect(getRouteOverrides('/index.html')).toEqual(['/index', '/']);
		expect(getRouteOverrides('/path')).toEqual([]);
		expect(getRouteOverrides('path')).toEqual(['/path']);
		expect(getRouteOverrides('/path.html')).toEqual(['/path']);
		expect(getRouteOverrides('/(group)/path')).toEqual(['/path']);
	});
});
