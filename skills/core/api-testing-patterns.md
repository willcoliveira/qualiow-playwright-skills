# API Testing Patterns

Playwright's runner without a browser. For services you call over HTTP: fixtures, bounded polling,
schema-validated responses, and assertions that survive a real network.

## The request context

`APIRequestContext` is what the `request` fixture provides. It needs no browser, so CI never runs
`playwright install` and a suite starts in milliseconds.

```typescript
// playwright.config.ts
export default defineConfig({
  use: { baseURL: process.env.API_BASE_URL, extraHTTPHeaders: { accept: 'application/json' } },
})
```

**Attach credentials per call, not through `extraHTTPHeaders`,** whenever the suite has negative
auth tests. A default header cannot be removed for one request, and an empty-string header is not
the same request as a missing one — which is exactly the distinction those tests exist to make.

```typescript
private headers(auth: 'key' | 'none' | 'wrong'): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' }
  if (auth === 'key') h['X-Api-Key'] = this.apiKey
  else if (auth === 'wrong') h['X-Api-Key'] = 'not-a-real-key'
  return h
}
```

## Two ways to call, and when each is right

```typescript
/** Asserts the documented contract. Throws on anything else. */
async createThing(input: Input): Promise<Thing> {
  const res = await this.raw('POST', '/things', { body: input })
  if (res.status !== 201) throw new Error(`expected 201, got ${res.status}: ${JSON.stringify(res.json)}`)
  return Thing.parse(res.json)
}

/** Returns the response. Never throws on a status code. */
async sendEvent(body: Event): Promise<RawResponse> {
  return this.raw('POST', '/events', { body })
}
```

Use the throwing form for setup, where a failure is not the thing under test and should stop the
test immediately with a clear message. Use the raw form wherever **the status code is itself the
observation** — a duplicate, a rejection, a rate limit. A helper that throws on a `409` makes the
`409` you were trying to measure unmeasurable.

## Contracts with a schema

```typescript
export const Thing = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'DONE']),
  amount: z.number(),
}).loose()      // .passthrough() in zod 3
```

Pin the fields your assertions depend on. Let everything else through: a field the service adds
next month must not turn into your incident. Parsing in the client rather than in the test means
every test gets the contract check for free and none of them have to remember.

## Waiting, without sleeping

One helper, one budget, one message. Never `waitForTimeout`.

```typescript
export async function waitForStatus(api: Api, id: string, expected: Status, budgetMs = BUDGET.SETTLE) {
  let last: Thing | undefined
  await expect.poll(async () => (last = await api.getThing(id)).status, {
    timeout: budgetMs,
    intervals: [250, 500, 1_000],
    message: `thing ${id} should reach ${expected} within ${budgetMs}ms`,
  }).toBe(expected)
  return last as Thing
}
```

**Derive the budget from something real** and write the arithmetic in a comment: the service's own
configured timeout, plus its polling interval, plus a round trip, times a margin. A budget nobody
can explain gets doubled every time the suite goes red.

**Asserting that nothing happened** is the hard case, because there is no state change to wait for.
Do not sleep and check. Anchor it to a sibling observable: wait for something that must happen
*after* the thing you are claiming did not happen, then assert. If the only anchor available is
time, say so in the README as a known blind spot rather than pretending the assertion is sound.

## Test data

```typescript
export const freshCustomer = (): string => `2547${String(randomInt(0, 1e8)).padStart(8, '0')}`
```

One fresh identity per test, generated randomly rather than from a counter: a counter collides with
the previous run whenever the environment is not wiped, which is most of the time.

**Assert deltas, not absolutes.** `balanceAfter - balanceBefore === amount` holds on a dirty
environment; `balance === amount` passes once and then fails forever. This single habit is the
difference between a suite that survives a shared environment and one that does not.

## Known defects

A confirmed bug is not a reason to delete a test or skip it.

```typescript
await expectKnownBug('BUG-002', () => {
  expectCredited(before, after, amount)     // what it SHOULD do
})
```

The test asserts the correct behaviour. The wrapper marks the run as an expected failure, so the
suite stays green and deterministic and the pass rate keeps meaning something — and when the defect
is fixed, the assertion passes and the wrapper throws instead, so a fix cannot land unnoticed.

Two details that matter: rethrow anything that is not an assertion error, or a `500` during setup
gets swallowed as "expected"; and make the report generator fail when a finding names a test that no
longer exists, or the two drift apart within a month.

## Request budgets against someone else's service

Log every state-changing request to a file and assert the count at the end of the run. Declare the
cost per test in a comment (`// POSTs: 3`) and sum it per file. A few dozen requests is verification;
a few thousand is a load test nobody agreed to, and the first anyone will hear about it is from the
team that owns the service.

## Configuration

Validate the environment once, at load, with a schema — not on first use, deep inside a test.

```typescript
// CI injects "" for a secret that is referenced but unset. Strip those or a
// default can never apply.
const cleaned = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''))
```

## Anti-patterns

- `waitForTimeout` anywhere. Enforce it with `playwright/no-wait-for-timeout` plus
  `no-restricted-globals` on `setTimeout`, so the rule is checked rather than remembered.
- `expect(res.status()).toBeGreaterThanOrEqual(400)`. A `500` is not a `409`.
- `try/catch` in place of `await expect(fn()).rejects.toThrow(/…/)`. A `catch` that forgets to fail
  when nothing throws is a test that can never fail.
- Absolute assertions on shared state.
- Retries on anything that asserts on money. A retry that hides a race is worse than no test.
