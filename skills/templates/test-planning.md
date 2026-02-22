# Test Planning Skill — {{PROJECT_NAME}}

## Overview

Use this guide when planning new E2E tests. Follow the exploration workflow below to understand the application before writing tests.

---

## Exploring Pages with Playwright CLI

Before writing tests, use `playwright-cli` to explore the application interactively:

```bash
# Open the application
playwright-cli open {{BASE_URL}} --headed

# Take a snapshot to see page structure
playwright-cli snapshot

# Navigate and interact
playwright-cli click e5
playwright-cli fill e3 "test input"

# Inspect specific areas
playwright-cli snapshot --selector "[data-testid='form']"
```

The CLI gives you real-time visibility into page structure, available selectors, and element states.

---

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
- Which configuration variant?

### 3. Flow Steps
Map each step to a page object:

<!-- YOUR PROJECT: Document your page object mapping here -->
<!-- Example:
- `loginPage` → `login(email, password)`
- `productPage` → `selectProduct(name)`, `addToCart()`
- `checkoutPage` → `fillShipping()`, `fillPayment()`, `submit()`
- `confirmationPage` → `expectOrderConfirmed()`
-->

### 4. Authentication
- Does the test need a logged-in user? → Use auth fixture or setup
- Does it need a guest user? → Skip login flow
- Does it need specific user attributes? → Use data factory with overrides

### 5. Teardown
- Does the test create data that needs cleanup? → Add `afterEach` hook
- Does it reserve resources? → Ensure release in teardown

### 6. Tags
Apply appropriate tags for CI filtering:

<!-- YOUR PROJECT: Document your tag system here -->
<!-- Example:
- `@smoke` — Critical flows (runs on every PR)
- `@regression` — Full coverage (runs nightly)
- `@mobile` — Mobile-specific tests
-->

---

## Planning Checklist

- [ ] Identified the application flow phases involved
- [ ] Selected the appropriate environment and configuration
- [ ] Determined authentication needs
- [ ] Planned teardown strategy
- [ ] Assigned appropriate tags
- [ ] Checked source application for selectors and component behavior
- [ ] Verified the test doesn't duplicate existing coverage
- [ ] Explored the page with playwright-cli to validate selectors
