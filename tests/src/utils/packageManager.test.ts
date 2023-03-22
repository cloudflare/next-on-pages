import { describe, test, expect, vi } from 'vitest';
import { getCurrentPackageManager } from '../../../src/utils/packageManager';

vi.mock('node:fs', async () => {
	return {
		existsSync: () => false,
	};
});

describe('getCurrentPackageManager', () => {
	test('to implement', () => {
		expect(getCurrentPackageManager()).toEqual('TO IMPLEMENT');
	});
});
