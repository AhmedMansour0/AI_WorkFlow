# Healing Log — OrangeHRM Auth & User Management Suite

Every self-heal applied to this suite is recorded here (project standard §5).

**Protocol** — on a failure, read only the exact stack trace and the failing
locator/response from the trace, then answer one question first:
*did the application break, or did the test break?*

- **Product defect** → do NOT heal. Raise a bug titled `[EndPoint][Title]` and,
  if it is a stable known deviation, mark the test `test.fail()` with the bug reference.
- **Test defect** → apply the narrowest fix in the page object / component (never in
  the spec unless the flow itself changed), verify with `--repeat-each`, log it below.

Never "heal" by raising global timeouts, adding `waitForTimeout`, `force: true`,
loosening an assertion, or adding retries.

### Known hazards designed in up front (not heals)

| Hazard | Source | Handling |
|---|---|---|
| Debounced field validation returns the previous value's message | exploration D-09 | `FormField.settledError()` / `expectNoError()` wait for a quiet window; username checks await the `/admin/validation/user-name` probe for the exact value |
| Row Edit/Delete are icon-only buttons with no accessible name | exploration §2.1 | Anchored on the icon glyph (`button:has(i.bi-pencil-fill)` / `bi-trash`) inside the row, not on index |
| OXD select is not a `<select>` | exploration §2.2 | `FormField.choose()` opens the widget and clicks `role=option` |
| Autocomplete shows a transient `Searching....` option | live DOM probe | `Autocomplete.pick()` waits for the employee API response and filters that option out |
| Below ~1000px the list switches to a mobile card layout that reorders cells | live DOM probe | Viewport pinned to 1280x720 in `playwright.config.ts` |
| Shared, volatile demo data | exploration D-10 | `UserFactory` creates unique disposable users and deletes them at teardown; no absolute counts |
| Logging out of the shared Admin session would break other workers | design | Logout tests use the `freshSession` fixture |

---

## HEAL-001 — Password reset hangs for existing usernames (classified: PRODUCT DEFECT)
- **Date:** 2026-10-13
- **Run:** `npx playwright test --grep @auth` → 35 passed, 2 failed
- **Tests:**
  - `tests/ui/auth/password-reset.spec.ts › TC-AUTH-UI-020 Reset Password screen accepts a username and submits`
  - `tests/ui/auth/password-reset.spec.ts › TC-AUTH-UI-022 Reset request does not disclose whether a username exists`
- **Failure:** `TimeoutError: locator.click: Timeout 20000ms exceeded` … `waiting for scheduled navigations to finish`
  at `src/pages/ForgotPasswordPage.ts:40` (`getByRole('button', { name: 'Reset Password' })`), plus
  `page.waitForResponse: Timeout 20000ms exceeded` at `ForgotPasswordPage.ts:36`.

**Diagnosis** — The locator resolved correctly and the click went through ("click action done"), so the
locator was not the problem. In the trace network log, `POST /auth/requestResetPassword` for
`NoSuchUser9901` returned **302 in 215 ms**; for the existing fixture user the same POST never completed
(status `-1`). A probe with a 180 s budget measured the existing-user POST at **504 Gateway Timeout after
60,125 ms**, against **302 in 310 ms** for an unknown username. The server most likely blocks on sending the
reset email. **Classification: product defect, not a test defect, so it was NOT healed.**

**Action taken**
1. Both tests are marked `test.fail()` with `KNOWN_DEFECTS.resetExistingUser504` (`src/data/testData.ts`),
   so they will report "unexpectedly passed" once the product is fixed. Per-test timeout is raised to 150 s
   for these two tests only, so the server's real 60 s response is observed.
2. Test change for clearer failures (not a heal): `src/pages/ForgotPasswordPage.ts` `requestReset()` now clicks
   with `noWaitAfter: true`, waits up to 75 s for the POST response and returns it without waiting for the
   URL. The specs now assert `status === 302` first, so the failure shows the real 504 instead of a
   misleading click timeout. Before: `resetButton.click()` + `waitForURL(sendPasswordReset)` inside the
   page object.

**Bug raised (draft, for the defect report)**

`[/web/index.php/auth/requestResetPassword][Password reset for an existing username times out with HTTP 504 while an unknown username returns 302 immediately, disclosing which accounts exist]`

- **Description:** Submitting the Reset Password form for an existing username leaves the request pending for about
  60 s and then returns HTTP 504 Gateway Timeout. The user never reaches the "Reset Password link sent successfully"
  screen. For a non-existent username the same form returns 302 to `/auth/sendPasswordReset` in about 300 ms. Valid
  users cannot complete the reset flow (FR-AUTH-5). The difference in status code and response time also reveals
  whether a username exists (NFR-SEC, user enumeration).
- **Steps to reproduce:** 1. Log out and open `/web/index.php/auth/requestPasswordResetCode`.
  2. Enter `NoSuchUser9901` and click Reset Password. Note the response. 3. Return to the reset screen, enter an
  existing username and click Reset Password. Note the response.
- **Expected Result:** Both submissions return the same 302 to `/auth/sendPasswordReset` within normal response
  time, and both show "Reset Password link sent successfully".
- **Actual result:** Step 2 returns 302 in about 310 ms and shows the confirmation screen. Step 3 returns 504 Gateway
  Timeout after about 60,125 ms and no confirmation screen is shown.

**Verification** — re-run `npx playwright test --grep @auth`: both tests now report as expected failures.

---

> Entries HEAL-002 … HEAL-005 come from full-suite run 1 (2026-10-13: 103 passed, 6 failed, 1 skipped).
> Full evidence and reasoning: `Execution-outputs/Automation/Automation_Healing_Log_2026-10-13.md`.

## HEAL-002 — "Fresh" browser context inherited the Admin session (TEST DEFECT)
- **Tests:** TC-ADM-UI-028, TC-ADM-UI-029, TC-ADM-UI-035 (admin-ui project only)
- **Failure:** `Timed out 15000ms waiting for expect(locator).toBeVisible()` · `locator('input[name="username"]')` at `src/pages/LoginPage.ts:42`
- **Diagnosis:** `browser.newContext()` inherits the project's `use.storageState`; in admin-ui the context was already logged in, so `/auth/login` redirected to the dashboard.
- **Heal:** `src/fixtures/test.ts` `freshSession` passes `storageState: { cookies: [], origins: [] }`.
- **Verification:** `--repeat-each=3` → TC-ADM-UI-028 and TC-ADM-UI-029 passed 3/3.

## HEAL-003 — Sort check depended on a JavaScript collator (TEST DEFECT)
- **Test:** TC-ADM-API-005 · **Failure:** `toEqual` mismatch, `"' OR '1'='1"` sorted first, `users-read.spec.ts:85`
- **Diagnosis:** the more-than-50-users fallback re-sorted with `Intl.Collator`; the server uses MySQL collation.
- **Heal:** fetch the whole set in one page each way and require DESC to equal ASC reversed; `toPass()` re-fetches only if a concurrent write changed the set.
- **Verification:** 3/3 passed.

## HEAL-004 — Precondition removed by a parallel test (TEST-DESIGN DEFECT)
- **Test:** TC-ADM-UI-002 · **Symptom:** skipped, `found 52` (TC-ADM-UI-032 seeds pagination users in parallel)
- **Heal:** assert `rows = min(counter, 50)` on page 1 instead of skipping.
- **Verification:** 3/3 passed.

## HEAL-005 — Self-delete test assumed a confirm dialog (TEST DEFECT; misdiagnosis corrected)
- **Test:** TC-ADM-UI-035 · **Failure:** confirm dialog never visible, `user-lifecycle.spec.ts:176`
- **First diagnosis (wrong):** a probe that sampled once after 3 s saw nothing, which suggested a "silent no-op" product bug (provisional BUG-07).
- **Corrected:** continuous sampling showed an error toast **"Cannot be deleted"** at +140 ms, auto-dismissed at about +2.7 s. The product is correct, and BUG-07 was withdrawn.
- **Heal:** assert the error toast (`Toast.expectError`), no dialog, no DELETE request, and that the account still exists.
- **Verification:** 3/3 passed.

## Not healed
- **TC-ADM-API-043:** PRODUCT DEFECT BUG-06 (username whitespace stored as-is) → `test.fail()`.
- **TC-ADM-API-042:** SPEC MISMATCH. Any user update ends that user's sessions (401 `Session expired`); the test case expects 403 without re-login. The assertion is left unchanged and a test-case amendment is recommended.

---

<!-- Template for each heal:

## HEAL-001 — <short title>
- **Date:** YYYY-MM-DD
- **Test:** `tests/<path>.spec.ts › <title>`
- **Failure:** `<exact error line>` / `<locator>`

**Diagnosis** — what the trace / live DOM showed. **Classification:** test defect | product defect.

**Heal applied** — `<file>:<line>`, from `<old>` to `<new>`, and why.

**Verification** — `npx playwright test <spec> --repeat-each=5` → n/n passed.
-->
