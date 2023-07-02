import { scrapeConfigs } from './utils';

(async function (): Promise<void> {
	const { allNextConfigs } = await scrapeConfigs(false);

	const tableHeadings = '| Option | Next Docs  | Support |';
	const divisor = '| ------ | ---------- | ------- |';

	let tableLines = [tableHeadings, divisor];

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

	console.log(tableLines.join('\n'));
})();
