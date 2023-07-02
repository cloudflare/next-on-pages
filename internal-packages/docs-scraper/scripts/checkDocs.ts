import type { NextConfig } from './utils';
import { fromGithubAction, scrapeConfigs } from './utils';

(async function (): Promise<void> {
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

	if (!fromGithub) {
		console.log(
			`The number of next configs is ${numOfNextConfigs} the next-on-pages documented next configs are ${numOfNextOnPagesDocumentedNextConfigs}`
		);
		console.log(
			`The number of undocumented next configs is ${undocumentedNextConfigs.length}`
		);
		console.log(
			`The number of documented non-next configs is ${documentedNonNextConfigs.length}`
		);
	}

	if (
		numOfNextConfigs !== numOfNextOnPagesDocumentedNextConfigs ||
		undocumentedNextConfigs.length > 0 ||
		documentedNonNextConfigs.length > 0
	) {
		if (!fromGithub) {
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
		} else {
			console.log('__gh_output__result=out-of-date');
			console.log(
				`__gh_output__undocumented_next_configs=${undocumentedNextConfigs
					.map(config => config.configName)
					.join(',')}`
			);
			console.log(
				`__gh_output__documented_non_next_configs=${documentedNonNextConfigs.join(
					','
				)}`
			);
		}
	} else {
		if (!fromGithub) {
			console.log('\nThe next-on-pages documentation is up to date');
		} else {
			console.log('__gh_output__result=up-to-date');
		}
	}

	const noNextConfigsDetected = allNextConfigs.length === 0;
	if (noNextConfigsDetected) {
		if (!fromGithub) {
			console.log(
				'\nERROR! No next configs were detected, the next docs might have changed!'
			);
		} else {
			console.log('__gh_output__result=no-next-configs-detected');
		}
	}

	const noNextOnPagesConfigsDetected =
		nextOnPagesDocumentedNextConfigs.length === 0;
	if (noNextOnPagesConfigsDetected) {
		if (!fromGithub) {
			console.log(
				'\nERROR! No next-on-pages configs were detected, the docs might have changed!'
			);
		} else {
			console.log('__gh_output__result=no-next-on-pages-configs-detected');
		}
	}
})();
