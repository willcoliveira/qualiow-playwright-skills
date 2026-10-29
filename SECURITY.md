# Security

## Reporting

Report a vulnerability privately through GitHub's
[private vulnerability reporting](https://github.com/willcoliveira/qualiow-playwright-skills/security/advisories/new)
rather than in a public issue. Include the version, the command you ran and what the generator
wrote or did. Expect an acknowledgement within a week.

## Scope

The CLI runs inside repositories its user did not write. Anything that lets such a repository make
`init` write, read or remove outside the project, execute project code, or put text of the
repository's choosing into the generated instructions is in scope. So is guidance in `skills/` that
would lead an agent to expose credentials or to weaken a test suite.

## Supported versions

Fixes go into the latest 2.x release. A version with a known vulnerability is deprecated on npm
with a pointer to the fix.
