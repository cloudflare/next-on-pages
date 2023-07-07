import type { NextConfig } from './utils';
import { fromGithubAction, scrapeConfigs } from './utils';
import { setOutput } from '@actions/core';

void (async function (): Promise<void> {
	const fromGithub = fromGithubAction();

	const { allNextConfigs, nextOnPagesDocumentedNextConfigs } =
		await scrapeConfigs();

	const undocumentedNextConfigs: NextConfig[] = [];
	allNextConfigs.forEach(config => {
		const configIsDocumented = nextOnPagesDocumentedNextConfigs.includes(
			config.configName
		);
		if (!configIsDocumented) {
			undocumentedNextConfigs.push(config);
		}
	});

	const documentedNonNextConfigs: string[] = [];
	nextOnPagesDocumentedNextConfigs.forEach(config => {
		const configExists = allNextConfigs.find(
			nextConfig => nextConfig.configName === config
		);
		if (!configExists) {
			documentedNonNextConfigs.push(config);
		}
	});

	const numOfNextConfigs = allNextConfigs.length;
	const numOfNextOnPagesDocumentedNextConfigs =
		nextOnPagesDocumentedNextConfigs.length;

	console.log(
		`The number of next configs is ${numOfNextConfigs} the next-on-pages documented next configs are ${numOfNextOnPagesDocumentedNextConfigs}`
	);
	console.log(
		`The number of undocumented next configs is ${undocumentedNextConfigs.length}`
	);
	console.log(
		`The number of documented non-next configs is ${documentedNonNextConfigs.length}`
	);

	if (
		numOfNextConfigs !== numOfNextOnPagesDocumentedNextConfigs ||
		undocumentedNextConfigs.length > 0 ||
		documentedNonNextConfigs.length > 0
	) {
		console.log('\nThe next-on-pages documentation is out of date');
		console.log(
			`The number of next configs is ${numOfNextConfigs} the next-on-pages documented next configs are ${numOfNextOnPagesDocumentedNextConfigs}`
		);
		console.log('============================================');
		console.log('The following configs are undocumented:');
		console.log(undocumentedNextConfigs.map(config => config.configName));
		console.log(
			'The following configs are documented but do not exist in the nextjs documentation:'
		);
		console.log(documentedNonNextConfigs);

		if (fromGithub) {
			setOutput('result', 'out-of-date');
			setOutput(
				'undocumented_next_configs',
				`${undocumentedNextConfigs.map(config => config.configName).join(',')}`
			);
			setOutput(
				'documented_non_next_configs',
				`${documentedNonNextConfigs.join(',')}`
			);
		}
	} else {
		console.log('\nThe next-on-pages documentation is up to date');

		if (fromGithub) {
			setOutput('result', 'up-of-date');
		}
	}

	const noNextConfigsDetected = allNextConfigs.length === 0;
	if (noNextConfigsDetected) {
		console.log(
			'\nERROR! No next configs were detected, the next docs might have changed!'
		);

		if (fromGithub) {
			setOutput('result', 'no-next-configs-detected');
		}
	}

	const noNextOnPagesConfigsDetected =
		nextOnPagesDocumentedNextConfigs.length === 0;
	if (noNextOnPagesConfigsDetected) {
		console.log(
			'\nERROR! No next-on-pages configs were detected, the docs might have changed!'
		);

		if (fromGithub) {
			setOutput('result', 'no-next-on-pages-configs-detected');
		}
	}
})();
