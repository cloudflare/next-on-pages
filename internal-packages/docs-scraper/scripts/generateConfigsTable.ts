import { fromGithubAction, scrapeConfigs } from './utils';
import { setOutput } from '@actions/core';

void (async function (): Promise<void> {
	const { allNextConfigs } = await scrapeConfigs(false);

	const tableHeadings = '| Option | Next Docs  | Support |';
	const divisor = '| ------ | ---------- | ------- |';

	const tableLines = [tableHeadings, divisor];

	allNextConfigs.forEach(config => {
		const option = `${config.configName}`;
		const pagesLink = config.urls.find(url => url.type === 'pages');
		const appLink = config.urls.find(url => url.type === 'app');
		const nextDocsLinks = [];
		if (pagesLink) {
			nextDocsLinks.push(`[pages](${pagesLink.href})`);
		}
		if (appLink) {
			nextDocsLinks.push(`[app](${appLink.href})`);
		}
		const nextDocs = nextDocsLinks.join(', ');
		const support = '???';
		tableLines.push(`| ${option} | ${nextDocs} | ${support} |`);
	});

	const table = tableLines.join('\n');

	console.log(table);

	if (fromGithubAction()) {
		setOutput('table', table);
	}
})();
