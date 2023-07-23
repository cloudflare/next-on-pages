export function fromGithubAction(): boolean {
	return !!process.env['GH_ACTION'];
}
