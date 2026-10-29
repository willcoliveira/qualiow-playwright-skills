# Contributing

## Setup

Requires Node.js >= 20.12.

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
