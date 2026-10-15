# Defect Reports — 2026-10-14

| Field | Value |
|---|---|
| **Run date** | 2026-10-14 |
| **Scope** | Manual execution — Authentication (AUTH), UI test cases only |
| **System under test** | OrangeHRM OS 5.9 — `https://opensource-demo.orangehrmlive.com/` |
| **Method** | Live execution through the Playwright MCP, cross-referenced with `Project-Documents/exploration.md` |
| **Defects raised** | 3 (one per failed test case) |
| **Companion report** | `Execution-outputs/Manual/Execution_Summary_2026-10-14.html` (section 3 contains the same reports) |

The same reports, with identical IDs and content, appear in the Defect Reports section of the execution summary.

---

## BUG-01

### `[/web/index.php/auth/validate][Disabled account returns "Account disabled" instead of the generic "Invalid credentials", disclosing account state and password correctness]`

*Severity: Medium–High · Traceability: TC-AUTH-UI-007 (contrast case TC-AUTH-UI-008) · FR-AUTH-3, NFR-SEC · exploration D-02 · previously reported as BUG-01 in the 2026-10-13 manual and automated runs*

**Description**

The login endpoint produces two distinguishable rejection messages. A disabled account submitted with its correct password is refused with the banner "Account disabled", while the same account submitted with a wrong password is refused with "Invalid credentials". An unauthenticated user can therefore confirm that a username exists and that a guessed password is correct, even though the account cannot sign in. This contradicts FR-AUTH-3, which requires authentication to be refused without disclosing which field was wrong.

**Steps to reproduce**

1. Sign in as Admin and create a test user: POST /web/index.php/api/v2/admin/users with {"username":"<unique>","password":"qaProbe1","status":true,"userRoleId":2,"empNumber":<existing employee>}.
2. Disable the user: PUT /web/index.php/api/v2/admin/users/{id} with {"username":"<unique>","password":"","status":false,"userRoleId":2,"empNumber":<same>,"changePassword":false}.
3. In a clean browser session, open /web/index.php/auth/login.
4. Log in with the disabled username and its CORRECT password (qaProbe1). Record the banner text.
5. Log in again with the same username and a WRONG password (totallyWrong1). Record the banner text.
6. Compare the two banners.

**Expected Result**

Both attempts are refused with the same generic banner "Invalid credentials", so nothing reveals whether the account exists, is disabled, or whether the password was correct.

**Actual result**

Reproduced on 2026-10-14 at 13:03 UTC with account qamanualmv84evt6: step 4 showed "Account disabled", step 5 showed "Invalid credentials". The functional control works (the disabled user cannot sign in), but the message leaks account state. See the annotated screenshot in TC-AUTH-UI-007.

---

## BUG-02

### `[/web/index.php/auth/requestResetPassword][Password reset for an existing username fails with HTTP 504 Gateway Time-out after about 60 seconds]`

*Severity: High · Traceability: TC-AUTH-UI-020 · FR-AUTH-5 · previously reported as BUG-04 in the 2026-10-13 automated run*

**Description**

Submitting the Reset Password form for an existing username leaves the request pending for about 60 seconds, after which nginx returns 504 Gateway Time-out. The user never reaches the "Reset Password link sent successfully" screen, so real users cannot start a password reset. The most likely cause is the server blocking while sending the reset email.

**Steps to reproduce**

1. Make sure a username exists (for example create an enabled test user through Admin > User Management > Users > Add).
2. Log out and open /web/index.php/auth/requestPasswordResetCode.
3. Enter the existing username and click Reset Password.
4. Record the status and duration of POST /web/index.php/auth/requestResetPassword and the page that is displayed.

**Expected Result**

The POST returns 302 to /web/index.php/auth/sendPasswordReset within normal response time and the "Reset Password link sent successfully" screen is shown.

**Actual result**

Reproduced on 2026-10-14 at 13:04 UTC with user qaresetmv84gk9h: the POST returned HTTP 504 after 60.2 s and the browser showed the nginx/1.18.0 "504 Gateway Time-out" page. No confirmation screen was shown. See the annotated screenshot in TC-AUTH-UI-020.

---

## BUG-03

### `[/web/index.php/auth/requestResetPassword][Reset Password responds differently for existing and unknown usernames, disclosing which accounts exist]`

*Severity: Medium–High · Traceability: TC-AUTH-UI-022 · FR-AUTH-5, NFR-SEC*

**Description**

The Reset Password form answers an unknown username with a 302 and the confirmation screen in about 0.3 seconds, but answers an existing username with a 504 error after about 60 seconds. The status code, the page shown and the response time all reveal whether a username exists, which allows unauthenticated user enumeration. This needs its own fix: even after BUG-02 is resolved, existing and unknown usernames must receive identical responses with comparable timing.

**Steps to reproduce**

1. Log out and open /web/index.php/auth/requestPasswordResetCode.
2. Submit the unknown username NoSuchUser9901. Record the status code, the response time and the page shown.
3. Open the reset page again and submit an existing username. Record the same three values.
4. Compare the two submissions.

**Expected Result**

Both submissions receive the same response (302 to /web/index.php/auth/sendPasswordReset and the same confirmation screen) with comparable timing, so the application does not reveal which usernames exist.

**Actual result**

Reproduced on 2026-10-14 at 13:05 UTC: the unknown username received 302 and the confirmation screen in 0.3 s; the existing username received HTTP 504 after 60.2 s and the nginx error page. See the annotated screenshot in TC-AUTH-UI-022.

---

*Prepared 2026-10-14 from live execution of 30 in-scope AUTH UI test cases; 3 failed and each failure is reported above.*
