---
name: playwright-automation
description: "Build, run and self-heal a Playwright (TypeScript) Page Object Model automation suite for the modules the user chooses, from test_cases.csv and exploration.md (cases with valid in scope = Yes and needs automation = Yes), saving results as Automation-prefixed files in Execution-outputs/Automation (execution summary HTML with a Defect Reports section, a separate defect reports file, and a healing log). Always asks the user which modules to automate before starting. Also the reference guide for locators, POM, fixtures, web-first assertions, dynamic elements and the self-healing protocol. Use when asked to automate test cases, create Playwright scripts or a POM suite, run or heal automated tests, or review Playwright code."
---

# Part A — Workflow: Playwright Automation for Selected Modules

This workflow is **module-agnostic**. It never assumes which modules to automate. The scope is chosen by the user in Step 0 on **every** invocation.

## Inputs
- The `Project-Documents` directory, specifically `test_cases.csv` (or `Test_Cases.csv`) and `exploration.md`.
- Part B of this skill (best practices) for every coding and healing decision.

## Step 0 — Ask which modules to automate (MANDATORY, every time)
Before reading code, writing files or running anything:
1. Read `test_cases.csv` and collect the module codes from the Test Case IDs (`TC-<MODULE>-<TYPE>-###`, e.g. `AUTH`, `ADM`, `PIM`). For each module, count the cases where `valid in scope` = 'Yes' **and** `needs automation` = 'Yes'.
2. Ask the user with the **AskUserQuestion** tool (`multiSelect: true`). Each option is one module, labelled with its code and readable name and described with its automatable-case count (e.g. "ADM — User Management · 72 automatable cases"). If there are more than four modules, offer the four with the most automatable cases; the user can type any others through "Other".
3. Ask this question **even if** the user's request already names modules or a previous run used a set of modules. The answer to this question is the only source of scope. Never reuse an earlier selection silently.
4. Do not continue until the user answers. Repeat the chosen modules back in one line, with their case counts, before Step 1.

## Steps
1. **Select cases.** Extract the test cases of the **selected modules** where `needs automation` is 'Yes' and `valid in scope` is 'Yes'. Report the count per module. Skip a module that has zero such cases and tell the user.
2. **Study the evidence.** Deeply analyze `exploration.md` for the selected modules to learn the actual UI locators, API endpoints and payloads, and every documented automation hazard (debounced validation, unnamed icon buttons, async loading, volatile shared data, and so on). Where a locator is uncertain, probe the live DOM with the Playwright MCP before writing the page object.
3. **Implement with POM.** Implement the Playwright automation scripts for these cases using the Page Object Model (POM) design pattern, following Part B.
4. **Autonomous structure.** The user does not dictate folder structure or file naming. Explore the workspace (reuse an existing suite and its page objects, fixtures and components when present; extend it instead of duplicating it), establish the POM architecture (page classes, component classes, fixtures and spec files) according to Playwright best practices, and write the code.
5. **Assertions and dynamic behaviour.** Apply strict web-first assertions and handle dynamic behaviour based on the exploration insights. Tests create and clean up their own data and must not depend on, or modify, records they did not create.
6. **Self-healing protocol.** When instructed to run the tests and a failure occurs, analyze only the exact stack trace and the failing locator or response, then classify the failure before touching code: product defect (do not heal; mark it `test.fail` with a bug reference), specification mismatch (keep the assertion; recommend a test-case amendment), environment issue (re-run in isolation), or test defect (apply the narrowest fix in the page object, component or fixture). Verify every heal with `--repeat-each=3` and log it in `healing-log.md`. See Part B §4.
7. **Save, don't print.** Save all generated `.ts` files directly to the project. Do not print the full code in the chat; confirm when the automation suite is ready, listing the modules covered and the number of cases automated.
8. **Execution results.** Store the Playwright test results in `Execution-outputs/Automation/`. **Every result file name starts with `Automation`.** Produce:
   - `Automation_Execution_Summary_YYYY-MM-DD.html`: the execution report, mimicking `resources/QA Execution Report Sample.html` (CLAUDE.md §4). It MUST include a dedicated **Defect Reports** section containing every bug in full, and each failed test case must link to its bug. Test cases that make two or more HTTP calls get a **Hops (n)** block with one entry per call (its own status badge, Request/Response/Expected/Actual/Evidence rows and a "View req & response" panel), built exactly as described in `.claude/skills/execution-reporter/SKILL.md` ("Hops"). Capture each hop during the run with `page.on('response')` or the `request` fixture and attach it to the test result, so the report shows real payloads (redacted), not reconstructed ones.
   - `Automation_Defect_Reports_YYYY-MM-DD.md`: the SAME bug reports as a separate Markdown file, identical in content to the HTML section (same `BUG-nn` IDs and titles). One bug per product defect, i.e. every test that fails because the application is wrong (including `test.fail` known defects). Test defects that were healed, environment issues and specification mismatches are NOT bugs; they belong in the healing log.
   - `Automation_Healing_Log_YYYY-MM-DD.md`: every failure triaged in the run, its classification and each heal applied.
   - Bug format (both places): strictly English, title `[EndPoint][Title]`, sections Description, Steps to reproduce, Expected Result, Actual result, plus the traceability IDs (Test Case ID, FR/NFR ID).

---

# Part B — Reference: Playwright Best Practices

**Audience:** QA Engineers writing and maintaining UI automation.
**Scope:** Locators, Page Object Model, assertions & waiting, dynamic elements & self-healing, HTML reporting.
**Language:** Examples below are JavaScript for brevity. Suites generated by Part A are written in **TypeScript** (`.ts`), which CLAUDE.md permits (Playwright JavaScript/TypeScript).

---

## 0. Setup

```bash
npm init -y && npm install --save-dev @playwright/test && npx playwright install --with-deps
```

```text
tests/pages/       # Page Objects — one file per page (login.page.js)
tests/components/  # Component Objects — reusable widgets (modal.component.js)
tests/fixtures/    # Custom fixtures, test data factories (pages.fixture.js)
tests/specs/       # Test specs — the only place test intent lives (login.spec.js)
playwright.config.js
```

---

## 1. Resilient Locators

A locator is a contract with the UI. Bind it to **what the user perceives**, not to how the markup happens to be built today. A brittle locator fails on a refactor that changed nothing a user can see — that costs triage time and teaches the team to distrust the suite.

### 1.1 Priority Order

Work **down** this list. Only drop a level when the level above is genuinely unavailable.

| # | Strategy | Method | Why |
|---|---|---|---|
| 1 | **Role** | `getByRole` | Matches the accessibility tree — what users and screen readers perceive. Survives styling and DOM restructuring. |
| 2 | **Label / Placeholder** | `getByLabel`, `getByPlaceholder` | Ties form fields to their visible labels. |
| 3 | **Text** | `getByText`, `getByTitle` | Fine for static copy; breaks on i18n and copy edits. |
| 4 | **Test ID** | `getByTestId` | Explicit contract with developers. Use when no semantic handle exists. |
| 5 | **CSS / XPath** | `locator('css=…')`, `locator('xpath=…')` | **Last resort.** Couples the test to implementation detail. |

```javascript
page.getByRole('button', { name: 'Submit', exact: true });
page.getByRole('button', { name: /submit/i });     // tolerant of case/whitespace
page.getByRole('heading', { name: 'Welcome', level: 1 });
page.getByLabel('Email address');                  // <label for="email"> or aria-label
page.getByTestId('checkout-submit');               // <button data-testid="checkout-submit">
```

Agree the `data-testid` contract with developers and treat it as API surface — renaming one is a breaking change. And if `getByRole` cannot find your element, that is frequently a **real accessibility defect** in the product (an unlabeled button, a `<div>` acting as a control). Raise it as a bug rather than routing around it with a CSS selector.

### 1.2 Filtering and Chaining — Instead of Long CSS Paths

This removes most of the remaining need for XPath. Compose narrow locators out of broad ones.

```javascript
// Pick the row that mentions a product AND has a Buy button
await page.getByRole('listitem')
    .filter({ hasText: 'Wireless Mouse' })
    .filter({ has: page.getByRole('button', { name: 'Buy' }) })
    .getByRole('button', { name: 'Buy' })
    .click();

page.getByRole('listitem').filter({ hasNotText: 'Out of stock' });   // exclude by text
page.getByRole('listitem').first();   // positional — order is a weak contract

// Scope to a region — avoids cross-page name collisions
await page.getByRole('region', { name: 'Shopping cart' })
          .getByRole('button', { name: 'Remove' }).click();

// Iframes need an explicit frame locator; Shadow DOM is pierced automatically
const frame = page.frameLocator('iframe[name="payment"]');
await frame.getByRole('textbox', { name: 'Card number' }).fill('4242424242424242');
```

---

## 2. Page Object Model (POM)

POM separates **what** a test does (intent, in the spec) from **how** it's done (locators and interactions, in the page object). The payoff is a single edit site when the UI changes.

### 2.1 Page Object

```javascript
// tests/pages/login.page.js
const { expect } = require('@playwright/test');

class LoginPage {
  constructor(page) {
    this.page          = page;
    this.emailInput    = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton  = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage  = page.getByRole('alert');
  }

  async goto() { await this.page.goto('/login'); }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message) {
    await expect(this.errorMessage).toContainText(message);
  }
}
module.exports = { LoginPage };
```

**Locators are assigned in the constructor, not resolved there.** Playwright locators are lazy descriptions — they re-query the DOM on every use, so a page object built before a re-render still works. This is why "stale element" exceptions do not exist in Playwright.

The spec should then read like a test case written in English:

```javascript
// tests/specs/login.spec.js
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/login.page');

test('successful login redirects to dashboard @smoke', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');
  await expect(page).toHaveURL('/dashboard');
});
```

### 2.2 Component Objects

Split reusable widgets out of page objects so a navbar is defined once, not per page. A component scoped to a **container locator** rather than the page can be reused for modals, rows and cards — anywhere the same widget appears. Compose components into pages and return the **next** object when an action navigates, so the flow documents itself.

```javascript
// tests/components/modal.component.js — scoped to a container, not the page
class ModalComponent {
  constructor(container) {
    this.title         = container.getByRole('heading');
    this.confirmButton = container.getByRole('button', { name: 'Confirm' });
  }
  async confirm() { await this.confirmButton.click(); }
}
module.exports = { ModalComponent };
```

```javascript
// tests/pages/dashboard.page.js
const { ModalComponent } = require('../components/modal.component');

class DashboardPage {
  constructor(page) {
    this.page             = page;
    this.navbar           = page.getByRole('navigation');
    this.newProjectButton = page.getByRole('button', { name: 'New Project' });
  }

  async createProject() {
    await this.newProjectButton.click();
    return new ModalComponent(this.page.getByRole('dialog'));   // next object
  }
}
module.exports = { DashboardPage };
```

### 2.3 Wiring Page Objects Through Fixtures

Removes the `new LoginPage(page)` boilerplate from every test and gives each page object a clean per-test lifecycle.

```javascript
// tests/fixtures/pages.fixture.js
const base = require('@playwright/test');
const { LoginPage } = require('../pages/login.page');
const { DashboardPage } = require('../pages/dashboard.page');

const test = base.test.extend({
  loginPage:     async ({ page }, use) => { await use(new LoginPage(page)); },
  dashboardPage: async ({ page }, use) => { await use(new DashboardPage(page)); },
});

module.exports = { test, expect: base.expect };
// In the spec: const { test, expect } = require('../fixtures/pages.fixture');
//   test('can login', async ({ loginPage, page }) => { … });
```

### 2.4 POM Rules

**Do**
- Keep every locator inside a page or component object — one source of truth.
- Name methods for user intent: `submitOrder()`, not `clickBlueButton()`; return the next page object when navigation happens.
- Expose locators as public properties so specs can write their own one-off assertions.
- Split a page object that exceeds ~200 lines into component objects.

**Don't**
- Don't bury assertions inside action methods — they belong in the spec, where the test's intent is stated. The exception is a named helper like `expectError()` used by many specs.
- Don't share mutable state between page object instances, and don't leak implementation detail (CSS classes, DOM structure) through the public API.
- Don't add a page object for a page used by exactly one test — a fixture is lighter.

---

## 3. Web-First Assertions & Auto-Waiting

### 3.1 Auto-Waiting and Retrying Assertions

Before any action, Playwright waits for the element to be attached, visible, stable (animations settled), enabled, and able to receive events — a manual wait before an action is almost always redundant. Likewise `expect(locator).…` polls until the condition holds or the timeout expires. This is what makes a suite stable under variable load.

```javascript
// State
await expect(page.getByRole('dialog')).toBeVisible();
await expect(page.getByText('Loading')).toBeHidden();
await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
await expect(page.getByRole('checkbox', { name: 'Terms' })).toBeChecked();

// Text and count
await expect(page.getByRole('heading')).toHaveText('Welcome');
await expect(page.getByRole('status')).toContainText('3 items');
await expect(page.getByRole('listitem')).toHaveCount(5);

// Attributes / values / page-level
await expect(page.getByLabel('Email')).toHaveValue('user@example.com');
await expect(page).toHaveURL(/\/dashboard/);

// Soft — report every failure of a screen at once instead of stopping at the first
await expect.soft(page.getByTestId('revenue-widget')).toBeVisible();
```

### 3.2 The Critical Distinction

Generic assertions (`expect(value).toBe(…)`) execute **once, immediately** — no retry. Using one against the DOM reintroduces every race condition auto-waiting removed.

```javascript
// ❌ Reads the DOM once. Fails if the text arrives 10ms later.
const text = await page.getByRole('heading').textContent();
expect(text).toBe('Welcome');

// ✅ Retries until the heading says Welcome, or the timeout expires.
await expect(page.getByRole('heading')).toHaveText('Welcome');
```

Rule: **if the subject is a `Locator` or a `Page`, the assertion must be awaited.** A missing `await` on a web-first assertion silently passes — it returns an unhandled promise. Enable `eslint-plugin-playwright` (rule `missing-playwright-await`) to catch this in review.

### 3.3 Never Hardcode Sleeps

`waitForTimeout()` is slow when the app is fast and flaky when the app is slow. It is never the right fix.

```javascript
await page.waitForTimeout(3000);   // ❌ arbitrary — hope three seconds is enough

// ✅ Wait for the actual condition
await page.getByRole('button', { name: 'Load data' }).click();
await expect(page.getByRole('row')).toHaveCount(10, { timeout: 10000 });

// ✅ Better — synchronize on the network event, then assert the UI
const responsePromise = page.waitForResponse(
  (r) => r.url().includes('/api/data') && r.request().method() === 'GET' && r.ok(),
);
await page.getByRole('button', { name: 'Load data' }).click();
await responsePromise;
await expect(page.getByRole('row')).toHaveCount(10);
```

The one defensible use of `waitForTimeout` is interactive local debugging. It should never reach `main`.

### 3.4 Explicit Waits When You Genuinely Need Them

```javascript
await page.waitForURL('**/dashboard');
await page.getByText('Loading…').waitFor({ state: 'hidden' });
await page.getByTestId('modal').waitFor({ state: 'detached' });
await page.waitForFunction(() => window.__APP_STATE__ && window.__APP_STATE__.isReady);

// Several in-flight requests plus the click that triggers them
await Promise.all([
  page.waitForResponse('**/api/user'),
  page.getByRole('button', { name: 'Load' }).click(),
]);
```

Avoid `waitForLoadState('networkidle')` as a routine step — on apps with polling or analytics beacons it never settles. Wait for the specific response you care about.

### 3.5 Polling Non-DOM Conditions

For asynchronous backend work (a job queue, an email, an eventual-consistency read):

```javascript
await expect(async () => {
  const response = await page.request.get('/api/job/123');
  expect((await response.json()).status).toBe('completed');
}).toPass({ intervals: [1000, 2000, 5000], timeout: 30000 });

// Or poll a single computed value
await expect.poll(async () => (await page.request.get('/api/job/123')).status()).toBe(200);
```

### 3.6 Timeout Configuration

```javascript
timeout: 60000,                 // playwright.config.js — per test
expect: { timeout: 10000 },     // playwright.config.js — per web-first assertion
test.setTimeout(120000);        // per test
await expect(page.getByTestId('report')).toBeVisible({ timeout: 30000 });  // per assertion
```

Raising the **global** timeout to make a flaky test pass masks the defect and slows every other test. Raise the single assertion that legitimately needs longer.

---

## 4. Dynamic Elements & Self-Healing

### 4.1 Handling Dynamic Elements

```javascript
// Generated IDs / hashed class names — never match on them
page.locator('#btn-7f3a9c2');                        // ❌
page.getByRole('button', { name: 'Place order' });   // ✅

// Lists that load progressively — assert the settled state
await expect(page.getByTestId('spinner')).toBeHidden();
await expect(page.getByRole('listitem')).toHaveCount(20);
const row = page.getByRole('row').filter({ hasText: 'ORD-10042' });  // content, not index

// Animations — disable them rather than waiting them out
use: { reducedMotion: 'reduce' },                    // playwright.config.js

// Volatile data (timestamps, counters, prices) — assert on shape, not value
await expect(page.getByTestId('order-total')).toHaveText(/^\$\d+\.\d{2}$/);

// Clock-dependent UI — freeze time instead of accommodating it
await page.clock.setFixedTime(new Date('2026-01-15T10:00:00Z'));

// Third-party services are not under test — stub them out
await page.route('**/api.analytics.com/**', (route) => route.fulfill({ body: '' }));
await page.route('**/api.payment-provider.com/**', (route) =>
  route.fulfill({ json: { status: 'ok', transactionId: 'test-123' } }));
```

### 4.2 Self-Healing: Diagnose Before You Repair

"Self-healing" means **repairing the script when the script is wrong** — not forcing a green run. The first question on every failure is the only one that matters:

> **Did the application break, or did the test break?**

Getting this backwards is the expensive failure mode: "healing" a test around a genuine product regression hides the bug and burns the suite's credibility.

```text
Test failed
│
├─ Does the product behave correctly when checked by hand?
│  ├─ NO  → Product defect. DO NOT heal. File a bug using the [Title]
│  │        convention, then test.fixme() with the bug reference.
│  └─ YES → Test defect. Proceed to heal.
│
├─ Fails consistently? → Locator or flow is out of date → heal the locator / steps
│
└─ Flaky, so which kind?
   ├─ Fails locally too              → timing/async   → fix waits & assertions
   ├─ Fails only in CI               → environment    → slower CPU, cold start, headless
   ├─ Fails only with >1 worker      → data collision → isolate per-worker data
   └─ Fails only after certain tests → state leak     → fix fixture cleanup
```

### 4.3 The Healing Loop

**Step 1 — Gather evidence.** Never heal from the error message alone. The trace viewer is the primary tool: it shows the DOM exactly as it was at the failing step, so you can see whether the element was absent, hidden, covered, or simply renamed.

```bash
npx playwright show-trace test-results/<test-name>/trace.zip        # actions, DOM, network
npx playwright test tests/specs/checkout.spec.js --debug            # step through live
npx playwright test tests/specs/checkout.spec.js --repeat-each=20   # confirm flakiness
npx playwright test --workers=1                                     # isolate parallelism
CI=true npx playwright test --repeat-each=10                        # reproduce CI conditions
```

**Step 2 — Inspect the live DOM to find the new handle.**

```javascript
// Temporary diagnostic — remove before committing
const candidates = await page.getByRole('button').all();
for (const c of candidates) {
  console.log(await c.textContent(), await c.getAttribute('data-testid'));
}
```

**Step 3 — Apply the narrowest fix that addresses the root cause.**

| Symptom in the trace | Root cause | Heal |
|---|---|---|
| Element never appeared | Locator out of date | Re-derive from accessible name; upgrade to `getByRole` |
| Appeared after the timeout | Slow async load | Synchronize on `waitForResponse`, or raise that one assertion's timeout |
| Resolved to 2+ elements (strict-mode violation) | Locator too broad | Add `.filter()` or scope to a region |
| Present but hidden, or click landed on the wrong element | Overlay, animation or layout shift | Assert the overlay is gone and layout settled first; `reducedMotion: 'reduce'` |
| Passes alone, fails in suite | State leak | Fix fixture cleanup; stop sharing contexts |
| Passes with 1 worker, fails with 4 | Shared test data | Per-worker unique data |

**Step 4 — Verify the heal.** A single green run proves nothing about a flake: `npx playwright test tests/specs/checkout.spec.js --repeat-each=20 --workers=4`.

**Step 5 — Document it.** Required by project standards: record every heal in `healing-log.md`.

### 4.4 Healing Log Template

```markdown
## HEAL-001 — Checkout submit button not found

- **Date:** 2026-10-11
- **Test:** `tests/specs/checkout.spec.js › completes order with saved card`
- **Failure:** `TimeoutError: locator.click: Timeout 30000ms exceeded`
  `waiting for getByRole('button', { name: 'Place order' })`

**Diagnosis** — Trace (`.../trace.zip`, step 14) shows the button present and visible
with accessible name **"Complete purchase"**; manual check confirms the product works
(copy changed in release 4.2.0). **Classification:** test defect, not a product bug.

**Heal applied** — `tests/pages/checkout.page.js:23`, from
`getByRole('button', { name: 'Place order' })` to `getByTestId('checkout-submit')`,
because the copy is marketing-owned and changed twice this quarter.

**Verification** — `--repeat-each=20 --workers=4` → 20/20 passed.
**Prevention** — Audited all page objects for marketing-owned copy; 3 others migrated.
```

### 4.5 What Self-Healing Is Not

| ❌ Not healing | Why it's harmful |
|---|---|
| Raising `retries` until it goes green | Hides a real defect; the bug ships |
| Bumping the global timeout | Masks root cause, slows the whole suite |
| Adding `waitForTimeout()` | Trades a fast flake for a slow one |
| Adding `{ force: true }` to a failing click | Bypasses the actionability check that caught a real problem |
| Loosening an assertion until it passes | Deletes the test's purpose |
| `test.skip()` with no ticket | Silent coverage loss, nobody comes back to it |

Retries are a **diagnostic** (they tell you a test is flaky, and capture a trace), not a fix.

```javascript
retries: process.env.CI ? 2 : 0,   // local runs expose flakes instead of hiding them

test.afterEach(async ({}, testInfo) => {   // surface flakes instead of passing quietly
  if (testInfo.retry > 0 && testInfo.status === 'passed') {
    console.warn(`FLAKY: ${testInfo.title} passed on retry ${testInfo.retry}`);
  }
});
```

### 4.6 Quarantine

When a flaky test can't be fixed immediately, isolate it — never let it block the pipeline silently. Quarantine must carry an owner and a ticket, or it becomes a graveyard.

```javascript
// playwright.config.js
projects: [
  { name: 'stable',     testIgnore: ['**/*.flaky.spec.js'] },
  { name: 'quarantine', testMatch: ['**/*.flaky.spec.js'], retries: 3 },
],

// In the spec
testInfo.annotations.push({ type: 'flaky', description: 'Payment API timing — JIRA-1234' });
test.fixme('checkout with expired card', async ({ page }) => {
  // Blocked by [Expired card at checkout returns 500 instead of validation error] — JIRA-5678
});
```

---

## 5. HTML Execution Reports

### 5.1 Baseline Configuration

```javascript
// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60000,
  expect: { timeout: 10000 },

  reporter: process.env.CI
    ? [
        ['dot'],                                              // compact CI log
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['junit', { outputFile: 'results/junit.xml' }],       // CI test tab
        ['github'],                                           // PR annotations
      ]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',          // actions + DOM snapshots + network
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
    reducedMotion: 'reduce',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },   // + firefox, webkit
  ],
});
```

### 5.2 Generating and Viewing

```bash
npx playwright test                       # report written to playwright-report/
npx playwright show-report                # serve it locally
npx playwright show-report path/to/report # open a report from elsewhere (e.g. a CI artifact)
```

The report lands at `playwright-report/index.html` and is self-contained — open it directly or zip and share it. Failed tests embed the screenshot, video, and a link to the trace.

### 5.3 Reporter Selection

| Reporter | Use for |
|---|---|
| `list` | Local development — one line per test |
| `dot` | CI logs — keeps them short |
| `html` | Post-run analysis, sharing with the team |
| `junit` | CI test tabs (Jenkins, GitLab, Azure DevOps) |
| `github` | PR annotations in GitHub Actions |
| `blob` | Sharded runs — merge with `npx playwright merge-reports --reporter=html` |

Pair `dot` with `html` in CI: readable logs plus a drill-down artifact.

### 5.4 Richer Reports via Test Steps

`test.step()` groups actions into collapsible, individually-timed sections — this is what turns a report into something a non-author can read.

```javascript
test('complete checkout @smoke', async ({ page, loginPage }) => {
  await test.step('Sign in', async () => {
    await loginPage.login('user@example.com', 'password123');
  });
  await test.step('Place order', async () => {
    await page.getByRole('button', { name: 'Checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  });
});

// Attach extra evidence to a test
await testInfo.attach('api-response', {
  body: JSON.stringify(data, null, 2),
  contentType: 'application/json',
});
// Tags slice the run: npx playwright test --grep @smoke  /  --grep-invert @slow
```

### 5.5 CI Artifact Upload (GitHub Actions)

```yaml
- name: Upload HTML report
  uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}          # keep the report on pass AND fail
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 14

- name: Upload failure artifacts
  uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: test-traces
    path: test-results/     # trace.zip, screenshots, videos
    retention-days: 7
```

> **Keep `test-results/` when you publish the report.** The HTML report links screenshots and videos from that directory — deleting it strips the evidence out of the report.

### 5.6 Reporting Anti-Patterns

| ❌ Anti-pattern | Problem | ✅ Fix |
|---|---|---|
| No reporter configured | Console output only; nothing to review later | `html` + a CI reporter |
| `trace: 'on'` / `video: 'on'` in CI | Huge artifacts, slow uploads and runs | `'on-first-retry'` / `'retain-on-failure'` |
| Upload artifacts only `if: failure()` | No report when the run is green | `if: ${{ !cancelled() }}` |
| `dot` alone, or JUnit XML to stdout | Cannot drill into a failure; corrupts the console | Pair with `html`; write XML to a file |
| Merging `html` across shards | Empty report | Emit `blob`, then `merge-reports` |
| No `retention-days` | CI storage fills up | 7–14 days |

---

## 6. Pre-Merge Checklist

- [ ] Every locator uses `getByRole` / `getByLabel` / `getByTestId` — no CSS chains, no XPath.
- [ ] All locators live in page or component objects, not in specs.
- [ ] No `waitForTimeout()` anywhere in the committed code.
- [ ] Every DOM assertion is a web-first assertion and is `await`ed.
- [ ] Each test is independent — passes alone and in any order.
- [ ] Test data is unique per worker; fixtures clean up after themselves; third-party services are stubbed.
- [ ] `test.step()` used for multi-stage flows so the report is readable.
- [ ] New tests burned in: `--repeat-each=20 --workers=4` all green.
- [ ] `trace`, `screenshot`, `video` configured; HTML report generates and uploads as a CI artifact.
- [ ] Any quarantined or `fixme` test carries a ticket reference and an owner.

---

## References

- Playwright docs: <https://playwright.dev/docs/best-practices>
- Trace viewer: <https://trace.playwright.dev>
