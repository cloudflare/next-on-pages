import { fromGithubAction } from './utils';
import { getOctokit, context } from '@actions/github';

void (async function (): Promise<void> {
	if (!fromGithubAction()) {
		console.error('Error: This script should be only run in a github action');
		process.exit(1);
	}

	const githubToken = process.env['GH_TOKEN'];

	if (!githubToken) {
		console.error('Error: no GH_TOKEN found');
		process.exit(1);
	}

	const octokit = getOctokit(githubToken);

	const label = 'outdated-config-docs';

	const { data: issues } = await octokit.rest.issues.listForRepo({
		owner: context.repo.owner,
		repo: context.repo.repo,
		state: 'open',
		labels: label,
		sort: 'created',
		direction: 'desc',
		per_page: 1,
	});

	if (issues.length > 1) {
		console.error('Error: Only one issue should be present, abort');
		process.exit(1);
	}

	const undocumentedNextConfigs = (process.env['undocumentedNextConfigs'] ?? '')
		.split(',')
		.filter(Boolean);
	const documentedNonNextConfigs = (
		process.env['documentedNonNextConfigs'] ?? ''
	)
		.split(',')
		.filter(Boolean);

	const issueBody = generateIssueBody(
		undocumentedNextConfigs,
		documentedNonNextConfigs,
	);

	if (issues.length === 0) {
		await octokit.rest.issues.create({
			owner: context.repo.owner,
			repo: context.repo.repo,
			labels: [label],
			title: '⚠️📄 The `next.config.js` supported doc is out of date 📄⚠️',
			body: issueBody,
		});
	} else {
		const issueNumber = issues[0]?.number;

		if (issueNumber) {
			await octokit.rest.issues.update({
				owner: context.repo.owner,
				repo: context.repo.repo,
				issue_number: issueNumber,
				body: issueBody,
			});
		}
	}
})();

function generateIssueBody(
	undocumentedNextConfigs: string[],
	documentedNonNextConfigs: string[],
): string {
	let issueBody =
		'### The next-on-pages documentation of the next.config.js options is out of date\n';

	if (undocumentedNextConfigs.length > 0) {
		issueBody += `\n\n${generateMdList(
			'The following next.config.js configs are not documented in our supported doc',
			undocumentedNextConfigs,
		)}`;
	}

	if (documentedNonNextConfigs.length > 0) {
		issueBody += `\n\n${generateMdList(
			'The following configs present in our supported doc are not present in the next.config.js documentation pages',
			documentedNonNextConfigs,
		)}`;
	}

	const hr = '\n\n___\n\n';

	issueBody += hr;

	issueBody += generateRememberToUpdateSection();

	issueBody += hr;

	const configsTable = process.env['configsTable'];
	if (configsTable) {
		issueBody += generateConfigsTableSection(configsTable);
	}

	return issueBody;
}

function generateMdList(listDescription: string, items: string[]): string {
	let list = `${listDescription}:\n`;
	if (items.length > 0) {
		list += items
			.filter(Boolean)
			.map(item => `- ${item}`)
			.join('\n');
	}
	return list;
}

function generateRememberToUpdateSection(): string {
	let rememberToUpdateSection = '';

	rememberToUpdateSection += '\n> **Warning**\n';
	rememberToUpdateSection += '> Remember to update:\n';
	rememberToUpdateSection +=
		'> - [The supported documentation](https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/supported.md#nextconfigjs-properties)\n';
	rememberToUpdateSection +=
		'> - [The eslint-plugin-next-on-pages no-unsupported rule](https://github.com/cloudflare/next-on-pages/blob/main/packages/eslint-plugin-next-on-pages/src/rules/no-unsupported-configs.ts)\n';

	return rememberToUpdateSection;
}

function generateConfigsTableSection(configsTable: string): string {
	let configsTableDetailsSection = '';

	configsTableDetailsSection += '\n<details>\n';
	configsTableDetailsSection += '<summary>Configs table template</summary>\n\n';
	configsTableDetailsSection +=
		'Template config table that you can use to update the supported doc:\n\n';
	configsTableDetailsSection += configsTable;
	configsTableDetailsSection += '\n\n</details>\n\n';

	return configsTableDetailsSection;
}
