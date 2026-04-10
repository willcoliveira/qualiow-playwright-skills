# Tracing{{#if HAS_PLAYWRIGHT_159}} & CLI Trace Analysis{{/if}}

Capture detailed execution traces for debugging and analysis. Traces include DOM snapshots, screenshots, network activity, and console logs.{{#if HAS_PLAYWRIGHT_159}} From Playwright v1.59+, traces can be analyzed entirely from the CLI — designed for AI agents to debug failing tests without opening a browser.{{/if}}

## Basic Usage (playwright-cli)

```bash
# Start trace recording
playwright-cli tracing-start

# Perform actions
playwright-cli open https://example.com
playwright-cli click e1
playwright-cli fill e2 "test"

# Stop trace recording
playwright-cli tracing-stop
```

{{#if HAS_PLAYWRIGHT_159}}
## CLI Trace Analysis (Playwright v1.59+)

Analyze trace files directly from the terminal. These commands work on `.zip` trace files produced by test runs or `playwright-cli tracing-stop`.

### Open a trace session

```bash
# Open a trace file for interactive CLI analysis
npx playwright trace open test-results/failing-test/trace.zip
```

### Inspect actions

```bash
# List all actions in the trace
npx playwright trace actions

# Filter to specific actions (e.g. assertions)
npx playwright trace actions --grep="expect"

# Filter to navigation events
npx playwright trace actions --grep="goto"
```

### Inspect page state at a specific step

```bash
# View DOM snapshot at action step 9
npx playwright trace snapshot 9

# Named snapshot for comparison
npx playwright trace snapshot 9 --name after

# View snapshot before and after a step
npx playwright trace snapshot 9 --name before
npx playwright trace snapshot 9 --name after
```

### Inspect network activity (API e2e)

```bash
# Show all failed HTTP requests
npx playwright trace requests --failed

# Show full error details
npx playwright trace errors

# Inspect specific request/response pairs
npx playwright trace requests --grep="api/orders"
```

## CLI Debug Mode (Playwright v1.59+)

Step through a failing test from the terminal — no browser UI needed.

```bash
# Run a specific test in CLI debug mode
npx playwright test tests/checkout.spec.ts --debug=cli

# Run with a specific test name filter
npx playwright test --debug=cli -g "should submit order"
```

In `--debug=cli` mode:
- Each test step is printed to the terminal as it executes
- On failure, the trace is automatically captured
- The agent can inspect the failure point without opening a browser
- Pairs with trace analysis commands for full investigation

## browser.bind() — Live Agent Inspection

`browser.bind()` exposes a running test's browser to CLI/MCP so an agent can attach and inspect live.

```typescript
// In a test or fixture setup
const browser = await chromium.launch()
const sessionUrl = await browser.bind()
// Agent can now connect to sessionUrl and inspect the live browser
```

Use cases:
- Agent attaches to a running test to inspect live DOM state
- Debug flaky tests by observing the browser in real time via CLI
- MCP server connects to bound browser for programmatic inspection

## Agent Debugging Workflow

The full loop for an AI agent to pick up a CI failure, investigate, and self-heal:

```bash
# 1. CI test fails — download the trace artifact
#    (trace.zip is produced by Playwright's built-in trace-on-first-retry)

# 2. Open the trace
npx playwright trace open test-results/checkout-spec/trace.zip

# 3. Jump to the failing assertion
npx playwright trace actions --grep="expect"

# 4. Inspect page state at the failure point (e.g. step 12)
npx playwright trace snapshot 12 --name after

# 5. Check for failed API calls
npx playwright trace requests --failed

# 6. Inspect error details
npx playwright trace errors

# 7. Based on findings, fix the test or report app bug

# 8. Re-run the specific test to verify the fix
npx playwright test tests/checkout.spec.ts --debug=cli
```

This workflow lets the agent investigate traces, identify root causes, apply fixes, and verify — all from the terminal. No browser UI, no manual intervention.
{{/if}}

## Trace Output Files

When you start tracing, Playwright creates a `traces/` directory with several files:

### `trace-{timestamp}.trace`

**Action log** - The main trace file containing:
- Every action performed (clicks, fills, navigations)
- DOM snapshots before and after each action
- Screenshots at each step
- Timing information
- Console messages
- Source locations

### `trace-{timestamp}.network`

**Network log** - Complete network activity:
- All HTTP requests and responses
- Request headers and bodies
- Response headers and bodies
- Timing (DNS, connect, TLS, TTFB, download)
- Resource sizes
- Failed requests and errors

### `resources/`

**Resources directory** - Cached resources:
- Images, fonts, stylesheets, scripts
- Response bodies for replay
- Assets needed to reconstruct page state

## What Traces Capture

| Category | Details |
|----------|---------|
| **Actions** | Clicks, fills, hovers, keyboard input, navigations |
| **DOM** | Full DOM snapshot before/after each action |
| **Screenshots** | Visual state at each step |
| **Network** | All requests, responses, headers, bodies, timing |
| **Console** | All console.log, warn, error messages |
| **Timing** | Precise timing for each operation |

## Use Cases

{{#if HAS_PLAYWRIGHT_159}}
### Agent-Driven Debugging (Recommended)

```bash
# Test failed in CI — trace was captured automatically
npx playwright trace open test-results/my-test/trace.zip

# Find what went wrong
npx playwright trace actions --grep="expect"
npx playwright trace snapshot 8 --name after

# For API failures
npx playwright trace requests --failed
npx playwright trace errors
```

### Interactive Debugging with --debug=cli

```bash
# Step through a failing test without a browser
npx playwright test tests/failing.spec.ts --debug=cli
```
{{/if}}

### Debugging Failed Actions

```bash
playwright-cli tracing-start
playwright-cli open https://app.example.com

# This click fails — why?
playwright-cli click e5

playwright-cli tracing-stop
# Open trace to see DOM state when click was attempted
{{#if HAS_PLAYWRIGHT_159}}
npx playwright trace open .playwright-cli/traces/trace-*.zip
npx playwright trace actions --grep="click"
npx playwright trace snapshot 2 --name after
{{/if}}
```

### Analyzing Performance

```bash
playwright-cli tracing-start
playwright-cli open https://slow-site.com
playwright-cli tracing-stop

# View network waterfall to identify slow resources
```

### Capturing Evidence

```bash
# Record a complete user flow for documentation
playwright-cli tracing-start

playwright-cli open https://app.example.com/checkout
playwright-cli fill e1 "4111111111111111"
playwright-cli fill e2 "12/25"
playwright-cli fill e3 "123"
playwright-cli click e4

playwright-cli tracing-stop
# Trace shows exact sequence of events
```

## Trace vs Video vs Screenshot{{#if HAS_PLAYWRIGHT_159}} vs CLI Trace Analysis{{/if}}

{{#if HAS_PLAYWRIGHT_159}}
| Feature | Trace | Video | Screenshot | CLI Trace Analysis |
|---------|-------|-------|------------|-------------------|
| **Format** | .trace file | .webm video | .png/.jpeg image | Terminal output |
| **DOM inspection** | Yes | No | No | Yes (snapshots) |
| **Network details** | Yes | No | No | Yes (requests/errors) |
| **Step-by-step replay** | Yes | Continuous | Single frame | Yes (actions + snapshots) |
| **Agent-friendly** | Needs GUI | No | Limited | Yes — fully terminal-based |
| **File size** | Medium | Large | Small | N/A (reads trace file) |
| **Best for** | Human debugging | Demos | Quick capture | Agent debugging |
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
| Feature | Trace | Video | Screenshot |
|---------|-------|-------|------------|
| **Format** | .trace file | .webm video | .png/.jpeg image |
| **DOM inspection** | Yes | No | No |
| **Network details** | Yes | No | No |
| **Step-by-step replay** | Yes | Continuous | Single frame |
| **File size** | Medium | Large | Small |
| **Best for** | Debugging | Demos | Quick capture |
{{/if}}

## Best Practices

{{#if HAS_PLAYWRIGHT_159}}
### 1. Enable trace-on-first-retry in CI

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry', // Captures trace only on retry — low overhead
  },
})
```

This ensures traces are always available when a test fails in CI.

### 2. Start Tracing Before the Problem
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
### 1. Start Tracing Before the Problem
{{/if}}

```bash
# Trace the entire flow, not just the failing step
playwright-cli tracing-start
playwright-cli open https://example.com
# ... all steps leading to the issue ...
playwright-cli tracing-stop
```

{{#if HAS_PLAYWRIGHT_159}}
### 3. Use --debug=cli for Quick Investigation

```bash
# Faster than capturing a full trace when you know which test is failing
npx playwright test tests/specific.spec.ts --debug=cli
```

### 4. Clean Up Old Traces
{{/if}}
{{#if NO_PLAYWRIGHT_159}}
### 2. Clean Up Old Traces
{{/if}}

Traces can consume significant disk space:

```bash
# Remove traces older than 7 days
find .playwright-cli/traces -mtime +7 -delete
```

## Limitations

- Traces add overhead to automation
- Large traces can consume significant disk space
- Some dynamic content may not replay perfectly
{{#if HAS_PLAYWRIGHT_159}}
- `--debug=cli` requires Playwright v1.59+
- `browser.bind()` requires Playwright v1.59+
{{/if}}
