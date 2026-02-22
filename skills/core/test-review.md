# Test Review Workflow

## When to Use

- Before submitting a PR with new or modified tests
- After writing new tests — self-review before requesting human review
- Periodic suite audit to catch accumulated anti-patterns
- When investigating flaky tests — check if the test itself has quality issues

---

## Review Checklist

### 1. Assertions

- [ ] Uses web-first assertions only (`await expect(locator).toBeVisible()`)
- [ ] No one-shot checks (`expect(await locator.isVisible()).toBe(true)`)
- [ ] Assertions are explicit in the test body — not hidden behind helpers that silently pass
- [ ] Prefers positive assertions (`toBeHidden()`, `toBeDisabled()`) over negated ones (`.not.toBeVisible()`)
- [ ] Every test has at least one explicit assertion

### 2. Selectors

- [ ] Priority order: `getByRole()` > `getByTestId()` > CSS selectors
- [ ] No XPath selectors
- [ ] Uses `{ exact: true }` where text could match multiple elements
- [ ] Selectors are stable — not tied to dynamic classes, indexes, or layout

### 3. Timing

- [ ] No `waitForTimeout()` calls (use web-first assertions or `waitFor()`)
- [ ] No `networkidle` in `goto()` or `waitForLoadState()`
- [ ] No redundant waits before auto-wait actions (e.g. `waitFor({ state: 'visible' })` before `.click()`)
- [ ] Correct `waitForResponse` ordering — listener setup before trigger action
- [ ] Uses named timeout constants, not hardcoded numbers

### 4. Isolation

- [ ] Tests are independent — no shared mutable state between tests
- [ ] Each test has its own setup and teardown
- [ ] No serial dependencies (test B doesn't rely on test A running first)
- [ ] Cleanup hooks (`afterEach`) properly release resources

### 5. POM Compliance

- [ ] Page objects instantiated through fixtures or factory, not direct `new`
- [ ] Action methods return `Promise<void>` — not new page objects
- [ ] Locators defined as readonly class properties or getters
- [ ] Page object methods wrapped in `test.step()` for trace reporting

### 6. Readability

- [ ] Uses `test.step()` with descriptive labels (Given/When/Then or plain English)
- [ ] Test names describe the user journey, not the implementation
- [ ] No magic numbers — uses named constants for timeouts, counts, amounts
- [ ] Complex logic has brief comments explaining "why", not "what"

### 7. Reliability

- [ ] Uses `toPass()` or `expect.poll()` over custom retry/polling loops
- [ ] No `{ force: true }` on click or other actions
- [ ] No `page.evaluate()` / `page.addInitScript()` workarounds
- [ ] No deprecated APIs (`waitForNavigation`, `Promise.all` with navigation)
- [ ] No `test.only()` or `test.skip()` in committed code

---

## Quality Gates

Quantitative thresholds for test quality. Flag violations as `CRITICAL`.

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Test file length | < 300 lines | Long files indicate missing abstractions or test flows |
| Single test execution time | < 90 seconds | Slow tests slow CI and are more likely to be flaky |
| Assertions per test | >= 1 explicit | Tests without assertions verify nothing |
| Skipped tests | 0 in committed code | Skipped tests are invisible failures |
| `.only` tests | 0 in committed code | `.only` silently skips the rest of the suite |

---

## Output Format

When performing a review, report findings using this format:

```
### Review Findings — {file name}

**CRITICAL** — {description}
  File: {path}:{line}
  Issue: {what's wrong}
  Fix: {how to fix it}

**WARNING** — {description}
  File: {path}:{line}
  Issue: {what's wrong}
  Fix: {how to fix it}

**INFO** — {description}
  File: {path}:{line}
  Suggestion: {optional improvement}
```

### Severity Definitions

| Severity | Meaning | Action |
|----------|---------|--------|
| `CRITICAL` | Breaks reliability, violates MUST rules, or fails quality gates | Must fix before merge |
| `WARNING` | Violates SHOULD rules or introduces maintainability risk | Should fix before merge |
| `INFO` | Suggestion for improvement, not blocking | Fix at your discretion |
