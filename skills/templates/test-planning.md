# Test Planning Skill — {{PROJECT_NAME}}

## Overview

Use this guide when planning new E2E tests. Explore the application before writing a test: real selectors, real flow, real prerequisites.

---

{{#if HAS_PLAYWRIGHT_CLI}}
## Exploring Pages with `playwright-cli`

Drive the real application from the terminal (command reference: the official `playwright-cli` skill):

```bash
# Open the application; --headed lets you watch
playwright-cli open {{BASE_URL}} --headed

# Accessibility snapshot of the page: roles, names and refs (e12) for every element
playwright-cli snapshot

# Search a large page instead of reading the whole snapshot
playwright-cli find "Add to cart"
playwright-cli find --regex "Sign (in|up)"

# Narrow to a region, or a ref from the snapshot
playwright-cli snapshot "#checkout-form"
playwright-cli snapshot e34

# Interact and watch the flow
playwright-cli click e5
playwright-cli fill e3 "user@example.com" --submit

# Get the locator to use in the page object
playwright-cli generate-locator e5

# Inspect an attribute (e.g. a data-testid)
playwright-cli eval "el => el.getAttribute('data-testid')" e5

playwright-cli close
```

`generate-locator` returns the locator Playwright itself would pick; prefer it over hand-written CSS.

{{#if HAS_PLAYWRIGHT_159}}
### Walk through an existing test

To learn a flow that already has a test, pause it and step through it: `npx playwright test {{TEST_DIR}}/checkout.spec.ts --debug=cli`, then `playwright-cli attach <session>` and `step-over`. See `agent-debugging.md`.
{{/if}}

---

{{/if}}
## Application Flow Phases

<!-- YOUR PROJECT: Document your application's main user flow here -->
<!-- Example:
```
1. Landing Page       → Entry point, navigation
2. Login/Register     → Authentication flow
3. Product Selection  → Browse, search, filter
4. Cart               → Add/remove items, apply coupons
5. Checkout           → Shipping, payment, confirmation
```
-->

---

## Test Plan Template

When planning a new test, document:

### 1. Test Objective
- What user journey is being tested?
- Which acceptance criteria does it verify?

### 2. Environment & Configuration
- Which environment? (staging, dev, etc.)
- Which viewport? (desktop, mobile)
- Which project in `playwright.config`?

### 3. Flow Steps
Map each step to a page object method (create the method if it does not exist):

<!-- YOUR PROJECT: Document your page object mapping here -->
<!-- Example:
- `loginPage` → `login(email, password)`
- `productPage` → `selectProduct(name)`, `addToCart()`
- `checkoutPage` → `fillShipping()`, `fillPayment()`, `submit()`
- `confirmationPage` → `expectOrderConfirmed()`
-->

### 4. Authentication
- Logged-in user? → `storageState` from the auth setup project (`fixtures-and-auth.md`)
- Guest user? → `test.use({ storageState: { cookies: [], origins: [] } })`
- Specific role or attributes? → role-specific state file or a data factory with overrides

### 5. Data and Teardown
- Which data does the test create? → dynamic factory (`data-strategy.md`), unique per test
- What must be cleaned up? → `afterEach` hook or fixture teardown
- Does it reserve shared resources? → per-worker accounts

### 6. Tags
Apply tags in the options object (`{ tag: ['@smoke'] }`) for CI filtering:

<!-- YOUR PROJECT: Document your tag system here -->
<!-- Example:
- `@smoke` — Critical flows (runs on every PR)
- `@regression` — Full coverage (runs nightly)
- `@mobile` — Mobile-specific tests
-->

---

## Planning Checklist

- [ ] Identified the application flow phases involved
- [ ] Selected the environment, viewport and project
- [ ] Determined authentication needs
- [ ] Planned test data and teardown
- [ ] Assigned tags
- [ ] Checked the source application for selectors and component behaviour
- [ ] Verified the test doesn't duplicate existing coverage
{{#if HAS_PLAYWRIGHT_CLI}}- [ ] Explored the page with `playwright-cli` and validated every selector with `generate-locator`{{/if}}
