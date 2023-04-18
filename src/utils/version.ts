import rawPackageJson from '../../package.json';

const packageJson = rawPackageJson as unknown as {
	version: string;
	nextOnPagesMetadata?: NextOnPagesMetadata;
};

/** Current version of the @cloudflare/next-on-pages package (in a helpful human readable form) */
export const nextOnPagesVersion = `${
	packageJson.version
}${getVersionExtraInfo()}`;

type NextOnPagesMetadata = { pullRequest?: number; beta?: boolean };

function getVersionExtraInfo(): string {
	const { nextOnPagesMetadata: { pullRequest, beta } = {} } = packageJson;

	if (pullRequest) {
		return ` (prerelease for PR #${pullRequest})`;
	}

	if (beta) {
		return ' (beta/canary release)';
	}

	return '';
}
