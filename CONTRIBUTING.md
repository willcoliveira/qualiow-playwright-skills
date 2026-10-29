# Contributing

## Setup

Requires Node.js >= 20.12. That runs the CLI from source, the tests and the checks; it is the
floor the package declares for its users. `npm run build` needs a release that tsup 9
supports: Node.js 22.18, 24.11 or newer.

```bash
npm ci
npm run dev -- init --platforms claude --dry-run   # try the CLI from source
```

## Before opening a pull request

```bash
npm run lint && npm test && npm run check:fences
```

When editing `skills/`:

- TypeScript examples must compile (`npm run check:fences`). See the top of
  `scripts/check-ts-fences.ts` for how to mark partial or intentionally wrong examples.
- If you change a rule listed in `skills/rules.manifest.tsv`, update the same rule in
  `skills/indexes/` too.

## Pull requests

- One change per pull request, with a [Conventional Commits](https://www.conventionalcommits.org/)
  title, e.g. `feat(skills): ...` or `fix(cli): ...`.
- Don't change the version number; releases do that.
- For larger changes, open an issue first.

## Releasing (maintainers)

A release is a pull request that bumps `version` in `package.json` and moves the Unreleased
changelog entries under the new version. Once it is merged, tag the merge commit `v<version>` and
push the tag: `.github/workflows/release.yml` runs the full check and publishes to npm through
trusted publishing, with provenance. Nothing is published from a laptop. The workflow is registered
on npmjs.com as the package's trusted publisher; a tag pushed without that registration fails at
the publish step and publishes nothing. The GitHub release and its notes are written by hand
afterwards.
