# Self-Healing & Fixing Process — 2026-10-13

| Field | Value |
|---|---|
| **Suite** | `automation/` — Playwright 1.49.1 (TypeScript, POM), OrangeHRM OS 5.9 |
| **Scope** | Authentication (`TC-AUTH-*`) + Admin / User Management (`TC-ADM-*`) — 108 automated test cases |
| **System under test** | `https://opensource-demo.orangehrmlive.com/` (shared public demo) |
| **Companion report** | `Execution-outputs/Automation/Automation_Execution_Summary_2026-10-13.html` |
| **Running log** | `automation/healing-log.md` |

This document explains **how** failures were handled and **what** was changed for every failure seen on 2026-10-13. It covers **9 incidents**: four test defects healed (HEAL-002 to HEAL-005, the last including a corrected misdiagnosis), two new product defects not healed (BUG-04, BUG-06), one specification mismatch (TC-ADM-API-042), one environment timeout and one precondition that couldn't be met.

---

## 1. Methodology

### 1.1 The one question asked first

> **Did the application break, or did the test break?**

Healing a test around a real product defect hides the bug, so no fix is applied before this question has an evidence-based answer.

```text
Failure
 │
 ├─ 1. Collect evidence — ONLY the exact error line, the failing locator / response, and the
 │     stack frame inside our code (project standard §5). Never read the whole run log.
 │
 ├─ 2. Reproduce in isolation with a throwaway diagnostic spec (zz-probe.spec.ts) that
 │     measures the real behaviour: status codes, timings, DOM state, network traffic.
 │     The probe is deleted as soon as the answer is known.
 │
 ├─ 3. Classify
 │     ├─ PRODUCT DEFECT  → do NOT heal. Mark the test test.fail(true, KNOWN_DEFECTS.x) with a bug
 │     │                    reference, raise the bug as [EndPoint][Title]. If the product is fixed
 │     │                    later, the test reports "unexpectedly passed" and the marker is removed.
 │     ├─ SPEC MISMATCH   → the product meets the requirement's intent, but the written expected
 │     │                    result does not match. Do NOT loosen the assertion; report FAIL and
 │     │                    recommend a test-case amendment.
 │     └─ TEST DEFECT     → heal.
 │
 ├─ 4. Heal with the narrowest fix at the right layer: page object / component / fixture first,
 │     spec only when the flow itself was wrong. Leave a HEAL-nnn comment at the fix site.
 │
 └─ 5. Verify with --repeat-each=3 (trace off, to avoid trace-file write races), then re-run the
       full suite.
```

### 1.2 Fixes that were not allowed

| ❌ Not allowed | Why |
|---|---|
| Raising global timeouts or `retries` | Masks the root cause and slows every test |
| `waitForTimeout()` in committed code | Trades a fast flake for a slow one (used only inside throwaway probes) |
| `{ force: true }` on clicks | Bypasses the actionability check that caught the problem |
| Loosening an assertion until it passes | Removes the purpose of the test |
| `test.skip()` without a reason | Silently loses coverage |

### 1.3 Hazards designed in before the first run (not heals)

| Hazard | Source | Handling in the suite |
|---|---|---|
| Debounced field validation returns the previous value's message | exploration D-09 | `FormField.settledError()` / `expectNoError()` wait for a 1.5 s quiet window; username checks await the `/admin/validation/user-name` call for that exact value |
| Row Edit/Delete are icon-only buttons with no accessible name | exploration §2.1 | Located by icon glyph (`button:has(i.bi-pencil-fill)` / `bi-trash`) within the row, not by index |
| OXD select is not a `<select>` | exploration §2.2 | `FormField.choose()` opens the widget and clicks `role=option` |
| Autocomplete shows a transient `Searching....` option | live DOM probe | `Autocomplete.pick()` waits for the employee API response and filters that option out |
| Below ~1000 px the list switches to a mobile card layout that reorders cells | live DOM probe | Viewport pinned to 1280×720 |
| Shared, volatile demo data | exploration D-10 | `UserFactory` creates uniquely named disposable users and deletes them at teardown; no absolute counts |
| Logging out of the shared Admin session would break other workers | design | Logout tests use the isolated `freshSession` fixture |

---

## 2. Timeline

| Run | Result | Action |
|---|---|---|
| `--grep @auth` (37 tests) | 35 passed, 2 failed | INC-01 → product defect BUG-04 |
| `--grep @auth` re-run | 37 as expected | INC-01 marked as a known defect |
| Full suite run 1 (110 tests) | 103 passed, 6 failed, 1 skipped | INC-02 … INC-07 triaged |
| Targeted verification (`--repeat-each=3`) | all healed tests 3/3 | — |
| Full suite final run (12:18:45–12:25:46 UTC) | 107 as expected, 2 failed, 1 skipped | INC-08, INC-09 triaged; TC-ADM-API-042 = INC-07 |
| TC-AUTH-UI-001 re-execution (`--repeat-each=3`) | 3/3 passed | Environmental timeout confirmed |
| **Reported (per test case)** | **108 cases: 99 PASS · 8 FAIL · 1 BLOCKED** | Basis for the HTML report |

---

## 3. Incidents

### INC-01 · TC-AUTH-UI-020, TC-AUTH-UI-022 — Password reset hangs · **PRODUCT DEFECT (BUG-04)**

- **Error:** `TimeoutError: locator.click: Timeout 20000ms exceeded … waiting for scheduled navigations to finish` at `src/pages/ForgotPasswordPage.ts:40`, plus `page.waitForResponse: Timeout 20000ms exceeded` at `:36`.
- **Evidence:** the locator resolved and the click completed, so the locator was fine. The trace network log showed `POST /auth/requestResetPassword` for `NoSuchUser9901` → **302 in 215 ms**, while for an existing user the same POST never completed. A probe with a 180 s budget measured **504 Gateway Timeout after 60,125 ms** for the existing user, against **302 in 310 ms** for the unknown one.
- **Classification:** product defect. Valid users cannot reset their password, and the different status and timing reveal which usernames exist.
- **Action:** both tests are marked `test.fail()` with `KNOWN_DEFECTS.resetExistingUser504`, and their per-test timeout is 150 s so the real 60 s response is observed. Test change for clearer failures: `requestReset()` now clicks with `noWaitAfter: true`, waits up to 75 s for the POST and returns it, and the specs assert `status === 302` first. A failure now shows the real 504 instead of a misleading click timeout.

### INC-02 · TC-ADM-UI-028, TC-ADM-UI-029, TC-ADM-UI-035 — Login field not found · **TEST DEFECT → HEAL-002**

- **Error:** `Timed out 15000ms waiting for expect(locator).toBeVisible()` · `Locator: locator('input[name="username"]')` at `src/pages/LoginPage.ts:42`.
- **Evidence:** the same `freshSession` fixture passed in the `auth-ui` and `api` projects and failed only in `admin-ui`, the one project configured with the Admin `storageState`. `browser.newContext()` in the test runner inherits the project's `use` options, so the "fresh" context was already logged in, and `/auth/login` redirected to the dashboard.
- **Heal:** `src/fixtures/test.ts`, where `freshSession` now passes `storageState: { cookies: [], origins: [] }` explicitly.
- **Verification:** a probe confirmed the context starts with zero cookies and the login form renders. TC-ADM-UI-028 and TC-ADM-UI-029 passed **3/3**. TC-ADM-UI-035 then progressed to a new failure (INC-06).

### INC-03 · TC-ADM-API-005 — Sort order mismatch · **TEST DEFECT → HEAL-003**

- **Error:** `expect(received).toEqual(expected)`. The received ASC list starts with `"' OR '1'='1"`, at `tests/api/admin/users-read.spec.ts:85`.
- **Evidence:** the demo now held 52 users, so the test took its more-than-one-page fallback, which re-sorted with a JavaScript `Intl.Collator({ ignorePunctuation: true })`. The server sorts with MySQL collation, where punctuation sorts first. No JavaScript collator reproduces that reliably; this risk had been flagged when the test was written.
- **Heal:** the check is now collation-agnostic. It fetches the whole set in one page in each direction (`limit = total + 25`), requires the page to contain the full set, and requires DESC to be exactly ASC reversed. `expect(...).toPass()` re-fetches the pair only if a concurrent write on the shared demo changed the set between calls. The order assertion itself is unchanged.
- **Verification:** **3/3** passed.

### INC-04 · TC-ADM-UI-002 — Skipped · **TEST-DESIGN DEFECT → HEAL-004**

- **Skip reason:** `Precondition: result set must fit one page of 50 (found 52)`.
- **Evidence:** TC-ADM-UI-032 adds users to reach more than 50 so it can test pagination, and it runs in parallel with TC-ADM-UI-002. One test's setup removed the other's precondition.
- **Heal:** the invariant is now asserted for any total: page 1 shows `min(counter, 50)` rows. The skip, which lost coverage, is removed.
- **Verification:** **3/3** passed.

### INC-05 · TC-ADM-API-043 — Username not trimmed · **PRODUCT DEFECT (BUG-06)**

- **Error:** `API should trim whitespace on creation` · `Expected: "qatrimmv6moa3r4aa810"` · `Received: " qatrimmv6moa3r4aa810 "` at `tests/api/admin/users-write.spec.ts:194`.
- **Evidence:** `POST /api/v2/admin/users` with `" <name> "` returned 200 and stored the username with the spaces.
- **Classification:** product defect, so no heal. Marked `test.fail()` with `KNOWN_DEFECTS.usernameNotTrimmed`.
- **Verification:** **3/3** expected failures, each for the right reason.

### INC-06 · TC-ADM-UI-035 — Self-delete flow · **TEST DEFECT → HEAL-005** (includes a corrected misdiagnosis)

- **Error (after HEAL-002):** `Timed out 15000ms waiting for expect(locator).toBeVisible()` on the delete confirmation dialog at `tests/ui/admin/user-lifecycle.spec.ts:176`.
- **First diagnosis (wrong):** a probe clicked Delete on the logged-in Admin's own row, waited 3 s, then looked for a dialog, toasts and DELETE requests. It found none, so the action was first classified as a "silent no-op" product defect (provisional BUG-07).
- **Why it was caught:** with that marker in place, the rewritten test **passed** 3/3, which contradicted the diagnosis. A second probe sampled toasts every 500 ms and found an **error toast `Cannot be deleted` at +140 ms that auto-dismisses at about +2.7 s**. The first probe had looked after the toast had already gone.
- **Correct classification:** test defect. The product behaves exactly as TC-ADM-UI-035 specifies: the action is blocked with a clear error and there is no dialog. **Provisional BUG-07 was withdrawn** and never filed.
- **Heal:** the test no longer branches on whether a dialog appears. It asserts the expected outcome directly: an `oxd-toast--error` reading `Cannot be deleted` (new `Toast.expectError()`), no dialog, no DELETE request, and the account still exists (API 200).
- **Verification:** **3/3** passed.
- **Lesson:** a probe that samples once after a fixed delay can miss short-lived UI states. Diagnostic probes now sample continuously from the moment of the action.

### INC-07 · TC-ADM-API-042 — 401 instead of 403 after role downgrade · **SPEC MISMATCH (not healed, not a bug)**

- **Error:** `role change must take effect mid-session` · `Expected: 403` · `Received: 401` at `tests/api/admin/users-authorization.spec.ts:72`.
- **Evidence:** the probe recorded these results for a disposable Admin "B" with a live session:

  | Step | Result |
  |---|---|
  | B calls `GET /admin/users` | 200 |
  | Admin A sends a **no-op** `PUT` (same role) to B | 200 |
  | B calls `GET /admin/users` | **401 `Session expired`** |
  | Admin A downgrades B to ESS | 200 |
  | B calls `GET /admin/users` | 401 `Session expired` |
  | B opens `/admin/viewSystemUsers` | redirected to `/auth/login` |

- **Classification:** **any** update to a user ends that user's sessions immediately. A downgraded admin loses access at once, which meets the security intent of the requirement and is stricter than asked. But the test case states *"403 Forbidden … without requiring re-login"*, and the build answers 401 and forces re-login. This is a mismatch with the written test case, not a security defect.
- **Action:** the assertion is **left unchanged**, because changing it to 401 would be loosening it to pass. The test is reported as FAIL with a recommendation to amend TC-ADM-API-042's expected result to *"next call returns 401 Session expired; the user must re-authenticate and then receives ESS-level access"*.

### INC-08 · TC-AUTH-UI-001 — Login page did not load · **ENVIRONMENT ISSUE (not healed)**

- **Error (final run):** `TimeoutError: page.goto: Timeout 45000ms exceeded` · `navigating to ".../auth/login", waiting until "load"` at `src/pages/LoginPage.ts:41`. No assertion was reached.
- **Evidence:** the test passed in all four earlier runs today. Re-executed in isolation with `--repeat-each=3`: **3/3 passed** in 6–10 s, and the login page answered in 0.8 s straight afterwards.
- **Classification:** the shared demo server was briefly unresponsive. It is neither a product nor a test defect, so nothing was changed: raising the navigation timeout would only hide the next real slowdown. Reported as PASS on re-execution, with the original timeout recorded in the report.

### INC-09 · TC-ADM-UI-032 — Skipped · **PRECONDITION NOT MET (BLOCKED)**

- **Skip reason:** `Seeding 44 users onto the shared demo is excessive`.
- **Evidence:** the public demo reset its database during the session (exploration D-10), leaving about 7 users. Reaching a second page (more than 50 users) would need 44 additional users, which is over the suite's safety limit of 20 for a shared instance.
- **Action:** none. The guard behaved as designed. Re-run when the demo holds 31 or more users, or against a dedicated environment.

---

## 4. Summary of changes

| ID | Type | File | Change |
|---|---|---|---|
| — | Test change (clearer failures) | `src/pages/ForgotPasswordPage.ts` | `requestReset()` returns the POST response (`noWaitAfter`, 75 s); specs assert the status first |
| HEAL-002 | Fixture | `src/fixtures/test.ts` | `freshSession` uses an explicit empty `storageState` |
| HEAL-003 | Spec | `tests/api/admin/users-read.spec.ts` | Sort check made collation-agnostic: full-set ASC vs reversed DESC |
| HEAL-004 | Spec | `tests/ui/admin/user-list.spec.ts` | Counter/rows invariant `min(counter, 50)` replaces the skip |
| HEAL-005 | Spec + component | `tests/ui/admin/user-lifecycle.spec.ts`, `src/components/Toast.ts` | Direct assertion of the "Cannot be deleted" error toast; new `Toast.expectError()` |
| Known defect | Marker | `src/data/testData.ts` | `resetExistingUser504` (BUG-04), `usernameNotTrimmed` (BUG-06) added to `KNOWN_DEFECTS` |

## 5. Defects at the end of the process

| Bug | Test(s) | Status |
|---|---|---|
| BUG-01 | TC-AUTH-UI-007 | Known, reproduced |
| BUG-02 | TC-ADM-UI-013 | Known, reproduced |
| BUG-03 | TC-ADM-API-014 | Known, reproduced |
| BUG-04 | TC-AUTH-UI-020, TC-AUTH-UI-022 | **New**, raised from INC-01 |
| BUG-05 | TC-ADM-API-016 | Exploration D-04, now raised as a bug because the automated test fails |
| BUG-06 | TC-ADM-API-043 | **New**, raised from INC-05 |
| ~~BUG-07~~ | TC-ADM-UI-035 | **Withdrawn**: misdiagnosis corrected in INC-06 |

Full bug write-ups in `[EndPoint][Title]` format are in section 3 (Defect Reports) of the Automation Execution Summary and, identically, in `Automation_Defect_Reports_2026-10-13.md`.
