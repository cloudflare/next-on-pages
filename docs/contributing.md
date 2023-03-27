# Contributing

We're thrilled that you're considering contributing to `@cloudflare/next-on-pages`, all contributions are greatly appreciated, regardless if they are simple issue reporting, bug fixes, documentation changes, etc...

No contribution is too small and all help moving the project forward!

## Submitting an issue or feature request

If you find an bug or want to request a feature, open a [new issue](https://github.com/cloudflare/next-on-pages/issues/new) documenting it, but first please check that:

- there isn't already an issue describing the same bug of feature request. If there is, please contribute to the conversation there (as this helps keeping all the information in a single place and also shows which bugs/features people are most interested in).
- if you've found a Next.js missing feature, make sure that it is not already documented in the [Supported Versions and Features document](./supported.md).

If you end up opening the issue make it as descriptive as possible, the more details you can provide the easier it will be for us to understand and handle it.

In case of bugs very useful things to add are:

- a minimal reproduction for it (both the steps to perform and the source code if possible)
- what version of `@cloudflare/next-on-pages` ad Next.js you're using
- your operative system and Node version
- what behavior you expected vs what behavior you got

<!-- TODO: add a template for issues and simplify the above -->

## Pull Requests

When opening a new PR make sure to set up an informative title for it and provide as much details as you can in the PR's description so that it is clear what its intentions are. This helps in simplifying and speeding up the reviewing process.

If your PR is addressing an existing issue make sure that it references the issue (as per the [Github PR Issues linking documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)) so that the two can be linked correctly (and the issue gets automatically closed on merge).

Smaller PRs are preferred since they are easier to review and merge quickly. If you're planning to make multiple unrelated (or loosely related) changes please consider splitting them in multiple PRs.

<!-- TODO: add section (or a link to a separate document) on how develop the package locally -->

### Not sure what to contribute on?

If you're looking for something to help us with, what we believe would be most valuable to us is to either: try to implement Next.js functionality which we currently don't support (which you can see in the [Supported Versions and Features document](./supported.md)), or help us fix existing [issues](https://github.com/cloudflare/next-on-pages/issues).

> For first time contributors, we currently don't have issues marked as `good first issue` or `help wanted` but keep an eye out for those labels in the future.

### Changeset

The repository uses [Changesets](https://github.com/changesets/changesets) to automate the versioning of the package and its changelog.

If you open a PR which contains functional changes (anything except documentation, testing, linting, CI, etc...) please provide a changeset by running:

```sh
npm run changeset
```

The command will prompt you to choose the kind of changes you're making, select:

- `patch` if your changes only contain backward compatible bug fixes,
- `minor` if your changes add functionality in a backward compatible manner,
- or `major` if your changes (bug fixes or functionality) aren't backward compatible.

> **Warning**
> We're currently very wary of making any breaking changes, so try not to fall in the latter category if possible, otherwise your PR's merge might get significantly delayed.

The command will generate a randomly named markdown file inside the `.changeset` directory. Commit this file and include it in your PR.
