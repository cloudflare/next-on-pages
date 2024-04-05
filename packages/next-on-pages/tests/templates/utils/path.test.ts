import { describe, test, expect } from 'vitest';
import { normalizeMultiSegmentsPath } from '../../../templates/_worker.js/utils/path';

describe('normalizeMultiSegmentsPath', () => {
	test('should not modify non multi-segment paths', () => {
		[
			'',
			'my-path',
			'/myPath/test/1',
			'/[slug]?slug=a/b/c',
			'/test?path=a/b/c',
		].forEach(path => expect(normalizeMultiSegmentsPath(path)).toEqual(path));
	});

	test('should normalize multi-segments paths', () => {
		const result = normalizeMultiSegmentsPath('/[[...path]]?path=a/b/c/d');
		expect(result).toEqual('/[[...path]]?path=a&path=b&path=c&path=d');
	});

	// Note: current versions of Next.js add this `nxtP` prefix to query params, so the function needs to correctly handle it
	//       (source: https://github.com/vercel/next.js/blob/bb74ece14/packages/next/src/lib/constants.ts#L3)
	test('should normalize multi-segments paths using nxtP', () => {
		const result = normalizeMultiSegmentsPath('/[[...path]]?nxtPpath=a/b/c/d');
		expect(result).toEqual('/[[...path]]?path=a&path=b&path=c&path=d');
	});
});
