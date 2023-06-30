const fs = require('fs');
const { exec } = require('child_process');

try {
	const nextOnPagesPackage = JSON.parse(
		fs.readFileSync('./packages/next-on-pages/package.json')
	);
	const eslintPluginPackage = JSON.parse(
		fs.readFileSync('./packages/eslint-plugin-next-on-pages/package.json')
	);

	exec('git rev-parse --short HEAD', (err, stdout) => {
		if (err) {
			console.log(err);
			process.exit(1);
		}
		const version = '0.0.0-' + stdout.trim();
		const nextOnPagesMetadata = {
			pullRequest: getPullRequestNumber(),
			beta: getIsBeta(),
		};
		nextOnPagesPackage.version = version;
		nextOnPagesPackage.nextOnPagesMetadata = nextOnPagesMetadata;
		eslintPluginPackage.version = version;
		nextOnPagesPackage.nextOnPagesMetadata = nextOnPagesMetadata;

		fs.writeFileSync(
			'./packages/next-on-pages/package.json',
			JSON.stringify(nextOnPagesPackage, null, '\t') + '\n'
		);
		fs.writeFileSync(
			'./packages/eslint-plugin-next-on-pages/package.json',
			JSON.stringify(eslintPluginPackage, null, '\t') + '\n'
		);
	});
} catch (error) {
	console.error(error);
	process.exit(1);
}

function getPullRequestNumber() {
	const match = /^PR=(\d+)$/.exec(process.argv[2] ?? '');
	return match?.[1];
}

function getIsBeta() {
	const isBeta = (process.argv[2] ?? '') === 'BETA';
	return isBeta || undefined;
}
