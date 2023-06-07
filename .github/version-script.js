const fs = require('fs');
const { exec } = require('child_process');

try {
	const package = JSON.parse(fs.readFileSync('./packages/next-on-pages/package.json'));
	exec('git rev-parse --short HEAD', (err, stdout) => {
		if (err) {
			console.log(err);
			process.exit(1);
		}
		package.version = '0.0.0-' + stdout.trim();
		package.nextOnPagesMetadata = {
			pullRequest: getPullRequestNumber(),
			beta: getIsBeta(),
		};
		fs.writeFileSync(
			'./packages/next-on-pages/package.json',
			JSON.stringify(package, null, '\t') + '\n'
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
