---
name: Playwright v1.59 Agent Debugging Upgrade
description: Major version bump planned to incorporate Playwright v1.59 CLI debug features (--debug=cli, trace analysis, browser.bind) into skill files
type: project
---

Playwright v1.59 introduced agent-facing CLI debugging capabilities that are a game-changer for AI-assisted test debugging:

- `npx playwright test --debug=cli` — steps through failing test from terminal
- `npx playwright trace open <trace.zip>` — opens a trace session
- `npx playwright trace actions --grep="expect"` — jump to failing assertion
- `npx playwright trace snapshot 9 --name after` — see exact page state at failure
- `browser.bind()` — lets running test expose browser to CLI/MCP for live agent inspection
- API e2e: `trace requests --failed` and `trace errors` for HTTP conversation inspection

**Why:** These features are 100% agent-facing, enabling AI agents (like BMad Test Architect) to pick up CI failures, investigate traces, self-heal, and get tests passing — cheaper and more precisely.

**How to apply:** This project (wico-playwright-agent-skills) needs a major version bump (v2.0.0) with breaking changes to update all skill files (especially playwright-cli/ and test-debugging) to incorporate these new capabilities. The BMad Test Architect (bmad-method@6.2.3-next.23) has already folded these in as a reference.
