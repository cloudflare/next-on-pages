import { describe, test, expect, suite } from 'vitest';
import { matchFunctionEntry } from '../src/utils';

const manifestEntries = [
	{ name: 'app dir - normal page', entry: 'app/test/page', file: 'test' },
	{ name: 'app dir - dynamic page', entry: 'app/[id]/page', file: '[id]' },
	{ name: 'app dir - nested page', entry: 'app/1/2/3/page', file: '1/2/3' },
	{ name: 'app dir - index page', entry: 'app/page', file: 'index' },
	{ name: 'app dir - route handler', entry: 'app/test/route', file: 'test' },
	{ name: 'pages dir - page', entry: 'pages/api/hello', file: 'api/hello' },
];

suite('manifest utils', () => {
	describe('match function entries', () => {
		manifestEntries.forEach(({ name, entry, file }) => {
			test(name, () => {
				expect(matchFunctionEntry(entry, file)).toEqual(true);
			});
		});
	});
});
