# Contributing

### Not sure what to contribute on?

If you're looking for something to help us with, what we believe would be most valuable to us is to either: try to implement Next.js functionality which we currently don't support (which you can see in the [Supported Versions and Features document](https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/supported.md)), or help us fix existing [issues](https://github.com/cloudflare/next-on-pages/issues).

> For first time contributors, check out issues labeled as `good first issue` or `help wanted`.

### Changeset

The repository uses [Changesets](https://github.com/changesets/changesets) to automate the versioning of the package and its changelog.

If you open a PR which contains functional changes (anything except documentation, testing, linting, CI, etc...) please provide a changeset by running (in the repository's root directory):

```sh
npm run changeset
```

The command will prompt you to choose the kind of changes you're making, select:

- `patch` if your changes only contain backward compatible bug fixes,
- `minor` if your changes add functionality in a backward compatible manner,
- or `major` if your changes (bug fixes or functionality) aren't backward compatible.

The command will generate a randomly named markdown file inside the `.changeset` directory. Commit this file and include it in your PR.
