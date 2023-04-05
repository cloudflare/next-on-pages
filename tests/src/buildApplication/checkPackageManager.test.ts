import { describe, expect, vi, it, afterEach } from 'vitest';
import { checkPackageManager } from '../../../src/buildApplication/checkPackageManager';
import { EventEmitter } from 'events';

let testStep = 0;

describe('checkPackageManager', async () => {
	// Initialize for Test Step - 0
	vi.stubEnv('npm_config_user_agent', 'yarn');
	vi.mock('child_process', async () => {
		return {
			spawn: () => {
				const event = new EventEmitter() as EventEmitter & {
					stdout: EventEmitter;
					stderr: EventEmitter;
				};
				event.stdout = new EventEmitter();
				event.stderr = new EventEmitter();
				setTimeout(() => {
					event.stdout.emit('data', testStep === 0 ? '3.0.0': '1.0.0');
					event.emit('close', 0);
				}, 100);
				return event;
			},
		};
	});
	vi.mock('fs/promises', async () => {
		return {
			stat: async () => null,
			readFile: async () => `nodeLinker: node-modules`,
		};
	});

	afterEach(async () => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		if (testStep === 0) {
			// yarn classic test environment
			vi.stubEnv('npm_config_user_agent', 'yarn');
		} else if (testStep === 1) {
			// pnpm test environment
			vi.stubEnv('npm_config_user_agent', 'pnpm');
		} else if (testStep === 2) {
			// npm test environment
			vi.stubEnv('npm_config_user_agent', 'npm');
		}
		testStep++;
	});
	// check if it return yarn (berry) - Test Step: 0
	it('should detected yarn (berry)', async () => {
		const pkgMng = await checkPackageManager();
		expect(pkgMng).toEqual('yarn (berry)');
	});
	// check if it return yarn (classic) - Test Step: 1
	it('should detected yarn (classic)', async () => {
		const pkgMng = await checkPackageManager();
		expect(pkgMng).toEqual('yarn (classic)');
	});
	// check if it return pnpm - Test Step: 2
	it('should detected pnpm', async () => {
		const pkgMng = await checkPackageManager();
		expect(pkgMng).toEqual('pnpm');
	});
	// check if it return npm - Test Step: 3
	it('should detected npm', async () => {
		const pkgMng = await checkPackageManager();
		expect(pkgMng).toEqual('npm');
	});
});
