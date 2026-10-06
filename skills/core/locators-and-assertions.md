# Locators and Assertions

## Strict mode

Every action and most assertions require the locator to match **exactly one** element. A locator that matches two elements fails with `strict mode violation` instead of silently using the first one.

How often it happens tells you what it is:

- **On every run** — a locator bug. The locator is broader than the page, and narrowing it is the whole fix.
- **Only on some runs** — a transient duplicate. Optimistic UI shows the pending row and the saved one
  together for a moment, a list re-renders, a second toast stacks on the first. Narrow the locator so
  only the settled element can match it, **and** assert the settled state before acting.

`.first()` is wrong in both cases. In the first it hides a locator that matches things it should not;
in the second it acts on whichever copy happens to be first in the DOM at that instant, which is the
flake moved somewhere harder to see.

```typescript
// Fails if the page has two "Delete" buttons
await page.getByRole('button', { name: 'Delete' }).click()

// Narrow the locator instead of reaching for .first()
await page.getByRole('row', { name: 'Invoice 1042' }).getByRole('button', { name: 'Delete' }).click()

// Intermittent: the optimistic row and the saved row coexist briefly.
// Match only the saved row, wait until there is exactly one, then act.
const savedRow = page.getByRole('row', { name: 'Invoice 1042' }).filter({ hasNot: page.getByText('Saving…') })
await expect(savedRow).toHaveCount(1)
await savedRow.getByRole('button', { name: 'Delete' }).click()

// Assert a count when several matches are expected
await expect(page.getByRole('listitem')).toHaveCount(3)
```

`first()`, `last()` and `nth()` are last resorts: they encode layout order, which changes.

---

## Selector priority

1. `getByRole(role, { name })` — what users and assistive tech see; survives markup changes
2. `getByLabel(text)` — form fields
3. `getByText(text)` / `getByPlaceholder` / `getByAltText` / `getByTitle` — visible text
4. `getByTestId(id)` — stable hook when there is no accessible name
5. `locator('css')` — structural fallback, never layout-dependent (`div > div:nth-child(3)`)

Never XPath.

Useful `getByRole` options: `exact: true` (whole-name match), `level` for headings, `checked`/`pressed`/`expanded` for state, `includeHidden` only when you really mean hidden elements.

```typescript
page.getByRole('heading', { name: 'Orders', level: 2 })
page.getByRole('checkbox', { name: 'Accept terms', checked: false })
page.getByText('Total', { exact: true })
```

---

## Composing locators

```typescript
const row = page.getByRole('row').filter({ hasText: 'Invoice 1042' })
const rowWithFailedBadge = page.getByRole('row').filter({ has: page.getByText('Failed') })
const rowsWithoutActions = page.getByRole('row').filter({ hasNot: page.getByRole('button') })
const visibleAlerts = page.getByRole('alert').filter({ visible: true })

// Playwright 1.63+: a dedicated method, and the recommended replacement for the
// `:visible` CSS pseudo-class
await page.getByRole('button', { name: 'Save' }).visible().click()

// Both conditions on the same element
const primarySubmit = page.getByRole('button', { name: 'Submit' }).and(page.locator('.primary'))

// Either of two elements
const dismiss = page.getByRole('button', { name: 'Close' }).or(page.getByRole('button', { name: 'Dismiss' }))

// Chain to scope
const cardNumber = page.getByRole('region', { name: 'Payment' }).getByLabel('Card number')
```

Chaining scopes the search; `filter()` narrows the matched set. Both keep the locator lazy, so it re-resolves on every action and assertion.

### Count a composed locator on the live page

`generate-locator` hands you a locator Playwright has already resolved against the page. One you put
together yourself — a chain, a `filter()`, a component scoped to a root, two page-object properties
joined — has been resolved by nobody. Before the test depends on it, open the page in the state the
test reaches and count what it matches:

```bash
playwright-cli run-code "async page => await page.getByRole('row', { name: 'Invoice 1042' }).getByRole('button', { name: 'Delete' }).count()"
```

`run-code` runs the function against the live page and prints what it returns. The number must be 1
for anything the test acts on, or exactly the figure a `toHaveCount()` expects. 0 means the chain is
wrong; 2 is a strict-mode violation that has not reached CI yet. If your `playwright-cli` has no
`run-code` (it is listed under DevTools in `playwright-cli --help`), use the locator field of the
Playwright Inspector instead — it highlights every element the locator matches.

---

## Iframes

```typescript
// Locate the iframe, then enter it
const payment = page.locator('iframe[title="Secure payment"]').contentFrame()
await payment.getByLabel('Card number').fill('4242 4242 4242 4242')
await expect(payment.getByText('Card accepted')).toBeVisible()
```

`page.frameLocator(selector)` is the older equivalent; `contentFrame()` composes with any locator, and `frameLocator.owner()` goes back to the `<iframe>` element.

---

## Web-first assertions

`expect(locator)` assertions retry until they pass or the expect timeout (default 5s) elapses. `expect(value)` assertions check once. Prefer the retrying kind for anything on the page.

```typescript
// Retries until visible
await expect(page.getByRole('alert')).toBeVisible()

// Checks once, at the moment it runs: flaky
expect(await page.getByRole('alert').isVisible()).toBe(true)
```

| Need | Assertion |
|------|-----------|
| Text, whole element | `toHaveText('Order placed')` (normalises whitespace; accepts regex) |
| Text, substring | `toContainText('placed')` |
| Input value | `toHaveValue('42')` |
| Attribute / class | `toHaveAttribute('aria-invalid', 'true')`, `toHaveClass(/active/)` |
| Count | `toHaveCount(3)` |
| State | `toBeVisible()`, `toBeHidden()`, `toBeEnabled()`, `toBeDisabled()`, `toBeChecked()`, `toBeFocused()`, `toBeEditable()`, `toBeInViewport()` |
| Accessibility | `toHaveAccessibleName('Close')`, `toHaveAccessibleDescription(...)`, `toHaveRole('dialog')` |
| Page | `expect(page).toHaveURL(/\/orders\/\d+/)`, `toHaveTitle(/Orders/)` |

Prefer the positive form of the opposite state (`toBeHidden()`) over `.not.toBeVisible()`: the message on failure is clearer and the intent is explicit.

Add a message when the assertion is not self-explanatory:

```typescript
await expect(page.getByTestId('order-total'), 'total must include the 10% promo').toHaveText('$90.00')
```

### Absence needs a presence anchor

`toBeHidden()`, `.not.toBeVisible()` and `toHaveCount(0)` all pass for a locator that matches
nothing — including one with a typo in it. An absence assertion on its own cannot tell "the dialog
closed" from "this locator never found a dialog", so it keeps passing on the day the feature breaks.

Give every absence assertion a **presence anchor**: prove the same locator matched earlier in the
test, or prove that what replaces the element is now on the page.

```typescript
// Vacuous: passes when the dialog closes, and equally when the name is misspelt
await expect(page.getByRole('dialog', { name: 'Edit adress' })).toBeHidden()

// Anchored on the element itself: the locator is proven to match before its absence means anything
const dialog = page.getByRole('dialog', { name: 'Edit address' })
await expect(dialog).toBeVisible()
await dialog.getByRole('button', { name: 'Save' }).click()
await expect(dialog).toBeHidden()

// Anchored on the replacement: the page has reached the state in which absence is the claim
await expect(page.getByRole('status')).toHaveText('Address saved')
await expect(page.getByRole('dialog', { name: 'Edit address' })).toHaveCount(0)
```

Prefer the first form. The replacement anchor proves the page moved on; only a locator that has
matched once is proven to be spelt right.

### A value shown in more than one place

The same value is often rendered several times — an order total in the basket summary, the header
badge and the pay button; a display name in the menu and on the profile. Each copy comes from
different code and goes stale on its own. Assert every place the behaviour under test is supposed to
update, not the first one you found: a test that checks only the summary passes while the header
still shows the old figure, and that is the bug a user reports.

```typescript
const total = '$90.00'
await expect.soft(page.getByTestId('summary-total')).toHaveText(total)
await expect.soft(page.getByRole('banner').getByTestId('basket-total')).toHaveText(total)
await expect.soft(page.getByRole('button', { name: /^Pay / })).toContainText(total)
expect(test.info().errors).toHaveLength(0)
```

Soft assertions here mean one run names every stale copy, not just the first.

### Soft assertions

Soft assertions record the failure and let the test continue, so one run reports every broken field instead of the first one.

```typescript
await expect.soft(page.getByTestId('status')).toHaveText('Shipped')
await expect.soft(page.getByTestId('eta')).toHaveText('Tomorrow')
// Bail out before doing something destructive if anything failed so far
expect(test.info().errors).toHaveLength(0)
```

Use them for verification blocks, never for preconditions.

### Custom timeouts

```typescript
await expect(page.getByText('Report ready')).toBeVisible({ timeout: 30_000 })

// Per-file default
const slowExpect = expect.configure({ timeout: 15_000 })
```

Set the suite default in `playwright.config.ts` (`expect: { timeout: 10_000 }`) rather than sprinkling timeouts through tests.

---

## Aria snapshots

`toMatchAriaSnapshot` asserts the accessibility tree of a region in one assertion. It is the right tool for "this whole component renders correctly" checks and for structure that is hard to express with individual assertions.

```typescript
await expect(page.getByRole('navigation')).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "Orders"
    - button "Account menu"
`)
```

- Generate the template from the real page: `playwright-cli snapshot` prints the same YAML, or run the assertion empty and `npx playwright test --update-snapshots` fills it in.
- Use regex for dynamic text: `- heading /Order #\\d+/`.
- Keep snapshots small and scoped to one region; a whole-page snapshot fails on every unrelated change.
- `expect(page).toMatchAriaSnapshot(...)` asserts the whole page. Useful for a landing page or an
  error state where the structure *is* the thing under test; a poor choice for anything with a
  sidebar someone else owns.

For a check that YAML cannot express — counting items, asserting an order, finding every control
missing an accessible name — take the tree as data instead:

```typescript
const tree = await page.ariaSnapshotJSON()
```

It returns the same tree as `ariaSnapshot()` serialized as JSON rather than YAML, and takes `boxes`,
`depth`, `mode`, `signal` and `timeout`. Assert against the structure in TypeScript; a snapshot is
the wrong tool once the assertion needs a loop.

---

## Visual comparison

```typescript
await expect(page.getByTestId('price-chart')).toHaveScreenshot('price-chart.png', {
  maxDiffPixelRatio: 0.01,
  mask: [page.getByTestId('timestamp')],
})
```

- Baselines are platform-specific (`price-chart-chromium-linux.png`); generate them on the same OS as CI, ideally inside the Playwright Docker image.
- Update deliberately with `npx playwright test --update-snapshots`, and review the diff in the HTML report.
- Mask or hide anything dynamic (timestamps, avatars, animations: `animations: 'disabled'` is the default).

### Rendering preferences are test options, not fixtures to build

Three media preferences are settable per test or per project, and each one is a real rendering mode
rather than a class you toggle — so a screenshot taken under them is the screenshot that user gets:

```typescript
test.use({ reducedMotion: 'reduce' })     // or 'no-preference' (default)
test.use({ forcedColors: 'active' })      // or 'none' (default)
test.use({ contrast: 'more' })            // or 'no-preference' (default)
```

`reducedMotion: 'reduce'` is the useful one beyond accessibility work: it stabilises visual
comparison on anything with a transition, without reaching for a timeout.

---

## Network mocking inside tests

Register routes **before** the navigation or action that triggers the request.

```typescript
// Stub a response
await page.route('**/api/products', route => route.fulfill({ json: [{ id: 1, name: 'Widget' }] }))

// Modify the real response
await page.route('**/api/products', async route => {
  const response = await route.fetch()
  const json = await response.json()
  json.push({ id: 999, name: 'Injected' })
  await route.fulfill({ response, json })
})

// Simulate failure
await page.route('**/api/products', route => route.fulfill({ status: 500, body: 'boom' }))
await page.route('**/api/analytics/**', route => route.abort())

await page.goto('/products')
```

Record and replay a whole API surface with HAR:

```typescript
// update: true records, false replays; commit the .har file
await page.routeFromHAR('tests/har/products.har', { url: '**/api/**', update: false })
```

Mocks make tests deterministic and fast, but they also stop the test from catching backend regressions. Mock third parties and rare error paths; keep the happy path against the real API.

### A HAR file goes stale; decide when, in advance

A HAR is the API as it was on the day it was recorded. The service keeps changing and the file does
not, so a test replaying it stays green through exactly the contract changes it would otherwise
catch. Treat each committed HAR as data with an expiry:

- **Record its provenance.** Next to the file (a comment in the spec, or a line in the folder's
  README): the date, the environment it was recorded against, and the command that re-records it
  (`update: true` on the same call).
- **Set a maximum age and hold to it.** Re-record when the endpoints it covers change, and at least
  on the schedule you wrote down. A HAR nobody can date is one nobody will refresh.
- **Let a missing entry fail.** Requests are matched on URL and method, and a POST on its body as
  well. Leave `notFound` at its default, `'abort'`: with `'fallback'` an unmatched request quietly
  goes to the live network, and the test half-replays an API that no longer exists.
- **Keep one live check per replayed endpoint.** The HAR proves the UI handles a known response; only
  a test against the real service (`api-testing-patterns.md`) proves the response is still that shape.
- **Read it before committing it.** A recording holds what crossed the wire — request headers, and
  whatever tokens or personal data the responses carried. Strip them, or record against an account
  that has nothing worth stealing.

---

## Controlling time

```typescript
// Install before navigation so the page never sees real time
await page.clock.install({ time: new Date('2025-01-15T09:00:00') })
await page.goto('/dashboard')

// Jump ahead to trigger timers (auto-logout, polling, countdowns)
await page.clock.fastForward('30:00')

// Freeze time so timestamps in the UI are stable
await page.clock.setFixedTime(new Date('2025-01-15T09:00:00'))

// Pause at a moment and resume
await page.clock.pauseAt(new Date('2025-01-15T09:05:00'))
await page.clock.resume()
```

Use `fastForward` for "the user waited N minutes" scenarios, `runFor` for precise timer ticks, and `setFixedTime` for screenshot stability.
