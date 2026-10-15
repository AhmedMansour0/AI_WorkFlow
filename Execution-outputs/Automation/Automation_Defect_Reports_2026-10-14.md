# Automation Defect Reports — 2026-10-14

| Field | Value |
|---|---|
| **Run date** | 2026-10-14 |
| **Scope** | Automated regression — Authentication (AUTH), UI and API (36 test cases) |
| **System under test** | OrangeHRM OS 5.9 — `https://opensource-demo.orangehrmlive.com/` |
| **Runner** | Playwright 1.49.1 (TypeScript) suite in `automation/` — run 13:41:35–13:44:02 UTC |
| **Defects raised** | 3 (one per product defect) |
| **Companion report** | `Execution-outputs/Automation/Automation_Execution_Summary_2026-10-14.html` (section 3 contains the same reports) |
| **Healing log** | `Execution-outputs/Automation/Automation_Healing_Log_2026-10-14.md` |

Only product defects are reported here. Healed test defects, environment issues and specification mismatches belong in the healing log; none occurred in this run.

---

## BUG-01

### `[/web/index.php/auth/validate][Disabled account returns "Account disabled" instead of the generic "Invalid credentials", disclosing account state and password correctness]`

*Severity: Medium–High · Traceability: TC-AUTH-UI-007 · FR-AUTH-3, NFR-SEC · exploration D-02 · also BUG-01 in the 2026-10-13 runs and the 2026-10-14 manual run*

**Description**

A disabled account submitted with its correct password is refused with the banner "Account disabled", while the same account with a wrong password is refused with "Invalid credentials". The two responses can be told apart, so an unauthenticated user can confirm that a username exists and that a guessed password is correct. This contradicts FR-AUTH-3, which requires login to be refused without disclosing which field was wrong.

**Steps to reproduce**

1. Create a user (POST /web/index.php/api/v2/admin/users) and disable it (PUT /web/index.php/api/v2/admin/users/{id} with status=false).
2. In a clean browser session, open /web/index.php/auth/login.
3. Log in with the disabled username and its CORRECT password; record the banner text.
4. Log in with the same username and a WRONG password; record the banner text.
5. Compare the two banners.

**Expected Result**

Both attempts are refused with the same generic banner "Invalid credentials".

**Actual result**

Reproduced by TC-AUTH-UI-007 on 2026-10-14 (automated run at 13:42 UTC): the correct password produced "Account disabled" (expected "Invalid credentials"). The test's annotated screenshot shows the banner.

---

## BUG-02

### `[/web/index.php/auth/requestResetPassword][Password reset for an existing username fails with HTTP 504 Gateway Time-out after about 60 seconds]`

*Severity: High · Traceability: TC-AUTH-UI-020 · FR-AUTH-5 · reported as BUG-04 in the 2026-10-13 automated run and BUG-02 in the 2026-10-14 manual run*

**Description**

Submitting the Reset Password form for an existing username leaves the request pending for about 60 seconds, after which nginx returns 504 Gateway Time-out. The user never reaches the "Reset Password link sent successfully" screen, so real users cannot start a password reset.

**Steps to reproduce**

1. Make sure a username exists (for example, create an enabled test user).
2. Log out and open /web/index.php/auth/requestPasswordResetCode.
3. Enter the existing username and click Reset Password.
4. Record the status and duration of POST /web/index.php/auth/requestResetPassword and the page shown.

**Expected Result**

The POST returns 302 to /web/index.php/auth/sendPasswordReset within normal response time and the confirmation screen is shown.

**Actual result**

Reproduced by TC-AUTH-UI-020 on 2026-10-14 (13:42 UTC): HTTP 504 (expected 302) after about 60 s, with the nginx/1.18.0 "504 Gateway Time-out" page and no confirmation. The test's annotated screenshot shows the error page.

---

## BUG-03

### `[/web/index.php/auth/requestResetPassword][Reset Password responds differently for existing and unknown usernames, disclosing which accounts exist]`

*Severity: Medium–High · Traceability: TC-AUTH-UI-022 · FR-AUTH-5, NFR-SEC · reported as part of BUG-04 in the 2026-10-13 automated run and as BUG-03 in the 2026-10-14 manual run*

**Description**

The Reset Password form answers an unknown username with a 302 and the confirmation screen almost immediately, but answers an existing username with a 504 error after about 60 seconds. The status code, the page shown and the response time all reveal whether a username exists, which allows unauthenticated user enumeration. Even after BUG-02 is fixed, both cases must receive identical responses with comparable timing.

**Steps to reproduce**

1. Log out and open /web/index.php/auth/requestPasswordResetCode.
2. Submit the unknown username NoSuchUser9901; record the status code, response time and page shown.
3. Open the reset page again and submit an existing username; record the same values.
4. Compare the two submissions.

**Expected Result**

Both submissions receive the same response (302 to /web/index.php/auth/sendPasswordReset and the same confirmation screen) with comparable timing.

**Actual result**

Reproduced by TC-AUTH-UI-022 on 2026-10-14 (13:42 UTC): the unknown username received 302 and the confirmation screen; the existing username received HTTP 504 (expected 302) after about 60 s. The test's annotated screenshot shows the error page.

---

*Generated from the automated AUTH run of 2026-10-14. The same reports, with identical IDs, appear in section 3 of the Automation Execution Summary.*
