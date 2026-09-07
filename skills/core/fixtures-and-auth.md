# Fixtures and Authentication

## Custom fixtures with `base.extend`

Fixtures give every test exactly the objects it needs, set up and torn down automatically. Extend the base `test` once, in a single fixtures file, and import `test` from there everywhere.

```typescript
// fixtures/test-fixture.ts
import { test as base, expect, type Page } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { CheckoutPage } from '../pages/checkout.page'
import { ApiClient } from '../helpers/api-client'

type TestFixtures = {
  loginPage: LoginPage
  checkoutPage: CheckoutPage
  testUser: { email: string; password: string }
}

type WorkerFixtures = {
  api: ApiClient
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Test-scoped: a fresh instance per test
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page))
  },

  // Setup before `use`, teardown after it
  testUser: async ({ api }, use) => {
    const user = await api.createUser()
    await use(user)
    await api.deleteUser(user.email)
  },

  // Worker-scoped: created once per worker process, shared by its tests
  api: [async ({}, use) => {
    const api = new ApiClient(process.env.API_URL!)
    await use(api)
    await api.dispose()
  }, { scope: 'worker' }],
})

export { expect }
```

```typescript
// tests/checkout.spec.ts
import { test, expect } from '../fixtures/test-fixture'

test('checks out as a new user', async ({ loginPage, checkoutPage, testUser }) => {
  await loginPage.login(testUser.email, testUser.password)
  await checkoutPage.expectEmptyBasket()
})
```

Rules:

- Re-export `expect` from the fixtures file so specs have a single import line.
- Fixtures are lazy: a test only pays for the fixtures it destructures.
- Use `{ auto: true }` for fixtures that must run for every test without being referenced (e.g. a console-error listener).
- Never share mutable state between tests through a worker fixture; give each test its own data.

### Overriding fixtures per file

```typescript
// Use a different viewport or locale for one describe block
test.use({ viewport: { width: 390, height: 844 }, locale: 'de-DE' })

// Override a custom fixture for a special scenario
test.use({
  testUser: async ({ api }, use) => {
    await use(await api.createUser({ role: 'admin' }))
  },
})
```

### Option fixtures

Make a fixture configurable from `playwright.config.ts`:

```typescript
type Options = { defaultCurrency: string }

export const test = base.extend<Options>({
  defaultCurrency: ['USD', { option: true }],
})

// playwright.config.ts → projects: [{ name: 'eu', use: { defaultCurrency: 'EUR' } }]
```

### Combining fixture sets

```typescript
import { mergeTests } from '@playwright/test'
import { test as pageTest } from './page-fixtures'
import { test as apiTest } from './api-fixtures'

export const test = mergeTests(pageTest, apiTest)
```

---

## Authentication with a setup project and `storageState`

Log in once, save the browser state, and let every test start authenticated. Tests stay independent (each gets a fresh context restored from the file) and the suite skips the login UI on every test.

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
})
```

```typescript
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Wait until the app is actually logged in before saving, or the cookies may be missing
  await page.waitForURL('/dashboard')
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
```

Add `playwright/.auth/` to `.gitignore`: the file contains session cookies.

### Faster: authenticate through the API

```typescript
setup('authenticate via API', async ({ request }) => {
  const response = await request.post('/api/login', {
    data: { email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD },
  })
  expect(response.ok()).toBeTruthy()
  await request.storageState({ path: authFile })
})
```

Use the API route when the login UI is not what the test is about. Keep one UI login test so the login page itself is still covered.

### Multiple roles

One state file per role, selected per file or per describe:

```typescript
// tests/admin/users.spec.ts
test.use({ storageState: 'playwright/.auth/admin.json' })
```

Tests that must start logged out reset the state:

```typescript
test.use({ storageState: { cookies: [], origins: [] } })
```

### One account per worker

When tests modify account state (orders, settings), give each worker its own account so parallel workers never collide:

```typescript
// fixtures/auth-fixture.ts
import { test as base } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export const test = base.extend<{}, { workerStorageState: string }>({
  // Every test in the worker uses this worker's state
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  workerStorageState: [async ({ browser }, use) => {
    const id = test.info().parallelIndex
    const fileName = path.resolve(test.info().project.outputDir, `.auth/${id}.json`)
    if (fs.existsSync(fileName)) {
      await use(fileName)
      return
    }

    // Fresh context without any storage state, log in as the account for this worker
    const page = await browser.newPage({ storageState: undefined })
    await page.goto('/login')
    await page.getByLabel('Email').fill(`e2e-worker-${id}@example.com`)
    await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('/dashboard')

    await page.context().storageState({ path: fileName })
    await page.close()
    await use(fileName)
  }, { scope: 'worker' }],
})
```

### Checklist

- [ ] Setup project has `testMatch` for `*.setup.ts` and browser projects list it in `dependencies`
- [ ] The setup test asserts a logged-in signal before saving state
- [ ] State files are ignored by git and written under `playwright/.auth/` or the project `outputDir`
- [ ] Credentials come from environment variables, never from test files
- [ ] Tests that mutate account data use per-worker accounts or clean up after themselves
- [ ] Session expiry is shorter than a CI run? Re-authenticate in a fixture instead of relying on a stale file
