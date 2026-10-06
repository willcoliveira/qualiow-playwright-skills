# CI and Flake Triage

## Configuration that pays for itself on CI

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // a committed test.only fails the build
  failOnFlakyTests: !!process.env.CI,     // 1.63+: a retry that saved the run still fails it
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,                        // per test
  expect: { timeout: 10_000 },            // per web-first assertion
  reporter: process.env.CI
    ? [['blob'], ['github']]              // blob for sharding, github for inline annotations
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,                // default is 0 (no limit); set one so hangs fail fast
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
})
```

Artifacts to upload from CI: `test-results/` (traces, screenshots, videos of failures) and `playwright-report/` or `blob-report/`.

**Treat those artifacts as secrets.** A trace records the value of every `fill()` — including the
password your setup project types — along with the headers of every request, cookies included, and
a screenshot or video shows whatever was on screen. Reports embed the traces. Anyone with read access
to the repository can download its artifacts, which on a public repository means anyone. So: run
the suite against test accounts that exist only for it; keep saved auth state in `playwright/.auth/`,
outside every uploaded path; set a short `retention-days`; and on a public repository, prefer
uploading reports only from runs that never had secrets.

### Scan before you upload

Policy says what should not be in an artifact; a scan says what is. Run one between the test step and
the upload, and make the upload depend on it — the sharding example below does both. Two details make
the difference between a scan and a false sense of one:

- **Unzip the traces first.** `trace.zip` is compressed, so a text search over it finds nothing
  whatever it holds. The blob and HTML reports embed copies of the same trace files, so scanning the
  unzipped traces in `test-results/` before anything is uploaded covers them too.
- **Gate the upload on the scan's outcome.** An upload step with `if: ${{ !cancelled() }}` runs after
  a failed step as well — that is why it is there — so on its own it would upload the very artifact
  the scan just flagged. The condition needs `steps.scan.outcome == 'success'`.

The search is for the literal value. A password containing quotes or backslashes appears escaped in
the trace's JSON, and one sent in a form body appears URL-encoded; if yours has such characters,
search for those forms too. If the CI container lacks `unzip`, install it in the step or scan in a
job that does not use the container.

### Choosing a trace and video mode

Both options take the same seven values. The distinction that matters is **record** versus **keep**:
a `retain-` mode records every run and throws away what it does not need, so it costs runtime on
every test but never misses a first failure. An `on-` mode only starts recording once a retry
begins, which is cheaper and cannot show you the run that actually failed.

| Mode | Records | Keeps |
| --- | --- | --- |
| `off` | nothing | — |
| `on` | every run | every run |
| `on-first-retry` | the first retry only | the first retry |
| `on-all-retries` | every retry | every retry |
| `retain-on-failure` | every run | runs that failed |
| `retain-on-first-failure` | the first run, not retries | that run, if it failed |
| `retain-on-failure-and-retries` | every run | anything that failed or is a retry |

`on-first-retry` is the usual CI default and the reason a flake is so often undiagnosable: the run
that failed was never recorded, and the retry that was recorded passed. `retain-on-failure-and-retries`
is the mode to reach for when you are actually chasing one — you get the failing run *and* the retry,
so you can compare them. Switch back when the flake is fixed; recording every run is not free, and
every extra trace is one more artifact carrying what the test typed.

---

## Parallelism and ordering

- `fullyParallel: true` runs tests inside a file in parallel too. Tests must not share state.
- `test.describe.configure({ mode: 'serial' })` runs a block in order and skips the rest after a failure. Use it only for genuinely sequential journeys; it hides independent failures and cannot be sharded across workers.
- `test.describe.configure({ mode: 'parallel' })` opts one file into parallelism when the global setting is off.
- `test.describe.configure({ retries: 0 })` / `{ timeout: 120_000 }` override per block.

```typescript
test.describe.configure({ mode: 'serial' })
test.describe('checkout journey', () => {
  test('adds to basket', async ({ page }) => { /* ... */ })
  test('pays', async ({ page }) => { /* ... */ })
})
```

---

## Sharding

Split the suite across CI machines; each shard runs a slice and writes a blob report, then one job merges them.

```yaml
# .github/workflows/e2e.yml
name: E2E
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    container: mcr.microsoft.com/playwright:v1.63.0-noble   # match your @playwright/test version
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          BASE_URL: ${{ vars.E2E_BASE_URL }}
          E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
      - name: Scan artifacts for the test password
        id: scan
        if: ${{ !cancelled() }}
        env:
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
        run: |
          test -n "$E2E_USER_PASSWORD" || exit 0   # an empty pattern would match every file
          mkdir -p trace-scan test-results blob-report   # grep exits 2 on a missing path, even after a match
          for zip in $(find test-results -name '*.zip'); do
            unzip -qo "$zip" -d "trace-scan/$(echo "$zip" | tr '/' '_')"
          done
          if grep -rlF -e "$E2E_USER_PASSWORD" test-results blob-report trace-scan; then
            echo "::error::the files above contain the test password; nothing was uploaded"
            exit 1
          fi
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() && steps.scan.outcome == 'success' }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report
          retention-days: 1

  report:
    needs: test
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { path: all-blob-reports, pattern: blob-report-*, merge-multiple: true }
      - run: npx playwright merge-reports --reporter html,json ./all-blob-reports
        env:
          PLAYWRIGHT_JSON_OUTPUT_FILE: results.json
      - name: Counts on the run page
        run: |
          node -e '
            const s = require("./results.json").stats
            console.log("| Expected | Unexpected | Flaky | Skipped |")
            console.log("| ---: | ---: | ---: | ---: |")
            console.log(`| ${s.expected} | ${s.unexpected} | ${s.flaky} | ${s.skipped} |`)
          ' >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@v4
        with:
          name: html-report
          path: playwright-report
          retention-days: 7   # traces inside carry typed values and request headers
```

Anything appended to the file `$GITHUB_STEP_SUMMARY` names is rendered as markdown on the run's
summary page, so the counts are readable without downloading a report. The JSON reporter's `expected`
includes tests marked `test.fail()` that failed as intended — label it "expected", not "passed"
(`pass-rate-and-flake-analysis.md` explains why the difference matters). Write any report meant for a
PR the same way: a markdown table a reviewer can paste, not a paragraph.

Without the container image, run `npx playwright install --with-deps` after `npm ci`.

Useful selection flags: `--project chromium`, `--grep @smoke`, `--grep-invert @slow` (`-G` is the
shorthand), `--last-failed`, `--only-changed` (tests affected by uncommitted or branch changes),
`--repeat-each 10`.

**Check the selection before you spend a run on it.** `--list` prints what a command would run and
runs nothing:

```bash
npx playwright test tests/checkout.spec.ts -g "pays" --list
```

`-g` is a regular expression over the whole title path, so "pays" also selects "pays with a voucher",
and every project in the config runs each match. Thirty repeats of a filter that selects three tests
across two projects is five runs of each, not thirty.

**Pass flags through `--` when the suite runs from an npm script.** In `npm run test:e2e -- -g "pays"
--retries=0`, everything after `--` reaches Playwright. Without the `--`, npm reads the flags as its
own options (`-g` is npm's `--global`) and they never arrive, so the run you get is not the one you
asked for — typically the whole suite, with the config's retries.

Two more worth knowing:

- `--fail-on-flaky-tests` — the command-line form of the config option, for a one-off run where you
  want a retry to fail the build without editing `playwright.config.ts`.
- `--add-reporter` — adds a reporter *on top of* the configured ones instead of replacing them.
  `--reporter=json` silently drops your HTML report; `--add-reporter=json` keeps it. This is the flag
  to use when a CI step needs machine-readable output and a human still wants the report.

---

## Marking tests honestly

| Situation | Use | Not |
|-----------|-----|-----|
| Known bug, test should fail until fixed | `test.fail(true, 'BUG-123')` — passes when it fails, fails when it unexpectedly passes | Commenting out the assertion |
| Test is broken or feature not ready | `test.fixme(true, 'BUG-456')` — skipped, tracked | `test.skip()` with no reason |
| Not applicable on some browser/env | `test.skip(browserName === 'webkit', 'WebKit lacks X')` | A bare `test.skip()` |
| Legitimately slow | `test.slow()` — triples the timeout | A hardcoded `test.setTimeout(999_999)` |

```typescript
test('exports a PDF', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'PDF export is Chromium-only')
  test.slow()
  // ...
})
```

`test.skip(condition, reason)` inside a test is fine in committed code; a bare `test.skip()` or `test.only()` is not.

---

## Flake triage

A test is flaky when it fails and then passes on retry with no code change. Retries hide flakes from the build status, so surface them: the HTML report marks them "flaky", `--fail-on-flaky-tests` turns them into failures, and CI reporters expose the count.

### Triage steps

1. **Collect evidence.** Open the trace of the failed attempt (`test-results/<name>-retry1/trace.zip`). The first attempt has no trace with `on-first-retry`; the retry does.
2. **Reproduce locally under stress, and count.**
   ```bash
   npx playwright test tests/checkout.spec.ts -g "pays" --repeat-each=20 --retries=0 --workers=1
   npx playwright test tests/checkout.spec.ts -g "pays" --repeat-each=20 --retries=0 --workers=8
   ```
   Failing only with many workers points at shared state; failing at `--workers 1` points at timing in the test itself.
   `--retries=0` matters: with the config's retries on, a failure that a retry rescues is reported as
   flaky rather than failed, and the count you came for is gone. Write down the result as failures
   out of runs — 4 of 20 — because that is the baseline a fix is measured against. How many runs
   afterwards it takes to call it fixed is in `pass-rate-and-flake-analysis.md`.
3. **Classify** using the table below, then fix the cause. Do not add retries, `waitForTimeout()`, or a larger timeout as the fix.
4. **Quarantine if you cannot fix it now** with `test.fixme(true, 'FLAKE-789')` so it stays visible, and open a ticket.

### Common causes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Fails only with many workers | Shared account, record or fixture mutated in parallel | Per-worker accounts, dynamic data factories, cleanup in `afterEach` |
| `strict mode violation` on some runs only | A transient duplicate: optimistic UI or a re-render shows two copies briefly. On every run, it is a plain locator bug | Narrow the locator so only the settled element matches, and assert the settled state before acting; never `.first()` (`locators-and-assertions.md`) |
| Assertion fails then passes | Assertion on a value that updates asynchronously | `expect(locator)` web-first assertion, `toPass()` or `expect.poll()` |
| Click has no effect | Element re-rendered between locate and click, or overlay in the way | Wait for the overlay to be hidden; assert the enabled state; never `force: true` |
| Passes locally, fails on CI | Slower machine, different viewport, missing env var | Assert on state rather than timing; set viewport explicitly; check secrets |
| Fails after a navigation | Listener registered after the request fired | `waitForResponse` promise before the action; `page.route` before `goto` |
| Randomly times out at 30s | Missing `actionTimeout`, hung network call | Set `actionTimeout`, inspect `requests` in the trace |
| Snapshot/visual diff | Animation, timestamp, font loading | `mask`, `page.clock.setFixedTime`, wait for fonts |

### Retries are a safety net, not a strategy

- Keep `retries` at 1–2 on CI and 0 locally so flakes are visible while developing. Use `retries: 0`
  for anything asserting on money or correctness, where a retry turns a real race into a green tick;
  `pass-rate-and-flake-analysis.md` covers how to prove determinism rather than retry around it.
- **Playwright 1.63+:** `failOnFlakyTests: !!process.env.CI` exits non-zero when anything passed only
  on retry. It is the setting that stops retries from quietly becoming the strategy — you keep the
  retry, so a genuine infrastructure blip still produces artifacts and a diagnosis, but the build
  goes red and somebody has to look. Turn it on before the flaky count is the thing you are tracking.
- Track the flaky count per week; a rising number means the suite is losing trust.
- Any test that needed a retry in three consecutive runs gets a ticket.
