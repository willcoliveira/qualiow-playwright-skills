# Agent Debugging — Attach, Step, Triage

How a coding agent investigates a failing Playwright test from the terminal. Command references for the browser live in the official `playwright-cli` skill and for traces in the official `playwright-trace` skill; this file is the workflow that ties them together.

{{#if HAS_PLAYWRIGHT_159}}
## Prerequisites

- Playwright >= 1.59 (`--debug=cli`, `browser.bind(name)`, `npx playwright trace`)
- `playwright-cli` available: bundled as `npx playwright cli` since 1.62, or `npm i -g @playwright/cli`
- The official skills installed in this project: `npx playwright cli install --skills` (Claude Code) or `npx playwright cli install --skills=agents` (Cursor, Copilot, Codex, Gemini), plus `npx playwright trace install-skill`

---

## Workflow 1 — Attach to the failing test with `--debug=cli`

`--debug=cli` starts the test, **pauses it at the first action**, and prints a session name. You attach `playwright-cli` to that session, step through the test, and inspect the live page. Every command you run against the page prints the equivalent Playwright TypeScript, which you can paste straight into the test.

```bash
# 1. Start the test in the BACKGROUND and keep reading its output until
#    "Debugging Instructions" appears (it prints the session name, e.g. tw-87b59e)
export PLAYWRIGHT_HTML_OPEN=never
npx playwright test tests/checkout.spec.ts -g "submits an order" --debug=cli

# 2. Attach to the paused test
playwright-cli attach tw-87b59e

# 3. Step over the next action; the output shows the page URL/title and where the test is paused
playwright-cli --session tw-87b59e step-over

# 4. Inspect the live page at any pause point
playwright-cli --session tw-87b59e snapshot
playwright-cli --session tw-87b59e find "Place order"
playwright-cli --session tw-87b59e generate-locator e12
playwright-cli --session tw-87b59e eval "document.querySelector('#error')?.textContent"

# 5. Try the fix interactively; the printed Playwright code is what goes into the test
playwright-cli --session tw-87b59e click "getByRole('button', { name: 'Place order' })"
```

Rules for this loop:

- Run the test in the background; the process stays alive while paused. Stop it when you are done.
- Use `-g` and a file path so only the failing test pauses.
- Step to the action *before* the failure, then inspect: the failing locator, an unexpected dialog, a missing prerequisite step.
- After editing the test, stop the background run and re-run the test normally to confirm it passes.

---

## Workflow 2 — Triage a trace from CI

Capture traces on CI with retries so the retry attempt records a trace:

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  use: { trace: 'on-first-retry' },
})
```

For a one-off run, `npx playwright test --trace on` records every test. Traces land in `test-results/<test-name>/trace.zip`.

Then work through the trace from the terminal:

```bash
# Extract the trace and print metadata (browser, duration, action and error counts)
npx playwright trace open test-results/checkout-submits-an-order-chromium/trace.zip

# What failed, and where in the test
npx playwright trace actions --errors-only
npx playwright trace errors

# Drill into the failing action: params, logs, source location, available snapshot phases
npx playwright trace action <action-id>

# Page state right after the failing action (accessibility tree)
npx playwright trace snapshot <action-id> --phase after
npx playwright trace snapshot <action-id> --phase before

# Query the frozen DOM or grab a screenshot of it
npx playwright trace snapshot <action-id> -- eval "document.querySelector('[role=alert]')?.textContent"
npx playwright trace snapshot <action-id> -- screenshot --filename=failure.png

# Cross-cutting views
npx playwright trace requests --failed
npx playwright trace requests --grep "/api/orders"
npx playwright trace request <request-id>
npx playwright trace console --errors-only

# Clean up the extracted data
npx playwright trace close
```

Reading order that finds most root causes quickly:

1. `errors` → which assertion or action failed, with its stack.
2. `snapshot <id> --phase after` → does the element exist with different attributes (LOCATOR_CHANGED), is it missing (ELEMENT_REMOVED), is an unexpected modal open (NEW_PREREQUISITE)?
3. `requests --failed` → 4xx/5xx from the app (API_FAILURE, often an app bug rather than a test bug).
4. `console --errors-only` → unhandled exceptions in the app (APPLICATION_BUG).
5. `actions` → timing: did the assertion run before the page settled (TIMING_ISSUE)?

If your Playwright build predates `--phase`, run `npx playwright trace --help`; 1.59 builds used `--name after` for the same thing.

---

## Workflow 3 — Expose a browser you launched yourself

When a script or fixture launches its own browser, bind it so an agent can attach:

```typescript
const browser = await chromium.launch()
const { endpoint } = await browser.bind('checkout-session', { workspaceDir: process.cwd() })
// Later: await browser.unbind()
```

```bash
playwright-cli attach checkout-session
playwright-cli -s checkout-session snapshot
```

`PLAYWRIGHT_DASHBOARD=1 npx playwright test` lists test browsers in the `playwright-cli show` dashboard.
{{else}}
## Prerequisites

The attach-and-step workflow (`npx playwright test --debug=cli`, `playwright-cli attach`) and terminal trace triage (`npx playwright trace`) need Playwright >= 1.59. Until you upgrade, use the tools below; the classification and decision tree in the debugging references still apply.

---

## Reproduce one test

```bash
# Only the failing test, one browser, with a trace of every attempt
npx playwright test tests/checkout.spec.ts -g "submits an order" --project chromium --trace on
```

## Inspect the trace

```bash
npx playwright show-trace test-results/checkout-submits-an-order-chromium/trace.zip
```

The trace viewer shows each action with a before/after DOM snapshot, the network log, console output and the source line. Look for: the failing action and its locator, whether the element exists with different attributes, failed requests (4xx/5xx), and console errors.

## Step through interactively (humans)

```bash
# Playwright Inspector: pauses before each action, lets you pick locators
npx playwright test tests/checkout.spec.ts -g "submits an order" --debug

# UI mode: watch mode with time-travel traces
npx playwright test --ui
```

`await page.pause()` inside a test opens the Inspector at that point (never commit it).

## Explore the page with `playwright-cli`

`playwright-cli` works with any Playwright version once installed (`npm i -g @playwright/cli`). Use it to check selectors against the real page:

```bash
playwright-cli open https://staging.example.com/checkout --headed
playwright-cli snapshot
playwright-cli find "Place order"
playwright-cli generate-locator e12
playwright-cli close
```
{{/if}}

---

## Classify before you fix

| Evidence | Classification | Action |
|----------|----------------|--------|
| Element present, attributes or text changed | LOCATOR_CHANGED | Update the locator (prefer `getByRole`) |
| Element absent, replacement exists | ELEMENT_REMOVED | Update the page object |
| Unexpected dialog/modal/step before the failure | NEW_PREREQUISITE | Add the missing step through an existing page-object method |
| Assertion ran before the page settled | TIMING_ISSUE | Web-first assertion or `waitForURL()`; never `waitForTimeout()` |
| Request returned 4xx/5xx that used to succeed | API_FAILURE | Confirm with the backend; usually an app or environment bug |
| Console error from application code | APPLICATION_BUG | Do not change the test; report the bug |

If a real user following the same steps would hit the same failure, it is an application bug: leave the test failing and report it.
