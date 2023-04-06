import packageJson from '../../package.json';

const rawNextOnPagesVersion = packageJson.version;

/** Current version of the @cloudflare/next-on-pages package (in a helpful human readable form) */
export const nextOnPagesVersion = `${rawNextOnPagesVersion}${getVersionExtraInfo()}`;

type NextOnPagesMetadata = { pullRequest?: number; beta?: boolean };

function getVersionExtraInfo(): string {
	const { nextOnPagesMetadata } = packageJson as unknown as {
		nextOnPagesMetadata?: NextOnPagesMetadata;
	};
	const { pullRequest, beta } = nextOnPagesMetadata ?? {};

	if (pullRequest) {
		return ` (prerelease for PR #${pullRequest})`;
	}

	if (beta) {
		return ' (beta/canary release)';
	}

	return '';
}
