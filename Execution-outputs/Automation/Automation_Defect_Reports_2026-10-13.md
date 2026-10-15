# Automation Defect Reports — 2026-10-13

| Field | Value |
|---|---|
| **Run date** | 2026-10-13 |
| **Scope** | Automated regression — Authentication (Login) + Admin / User Management, UI and API |
| **System under test** | OrangeHRM OS 5.9 — `https://opensource-demo.orangehrmlive.com/` |
| **Runner** | Playwright 1.49.1 (TypeScript) suite in `automation/` — final run 12:18:45–12:25:46 UTC |
| **Defects raised** | 6 (3 new in this run) |
| **Companion report** | `Execution-outputs/Automation/Automation_Execution_Summary_2026-10-13.html` (section 3 contains the same reports) |
| **Healing log** | `Execution-outputs/Automation/Automation_Healing_Log_2026-10-13.md` |

Only product defects are reported here. Test defects that were healed, environment issues and the specification mismatch on TC-ADM-API-042 are recorded in the healing log, not as bugs.

---

## BUG-01

### `[/web/index.php/auth/validate][Disabled account returns "Account disabled" instead of the generic "Invalid credentials", disclosing account state and password correctness]`

*Severity: Medium–High · Traceability: TC-AUTH-UI-007 · FR-AUTH-3, NFR-SEC · exploration D-02*

**Description**

A disabled account submitted with its correct password is refused with the banner "Account disabled", while the same account with a wrong password is refused with "Invalid credentials". The two responses can be told apart, so an unauthenticated user can confirm that a username exists and that a guessed password is correct. This contradicts the FR-AUTH-3 requirement to refuse login without disclosing which field was wrong.

**Steps to reproduce**

1. Create a user (POST /web/index.php/api/v2/admin/users) and disable it (PUT /web/index.php/api/v2/admin/users/{id} with status=false).
2. In a clean browser session open /web/index.php/auth/login.
3. Log in with the disabled username and its CORRECT password; record the banner text.
4. Repeat with a WRONG password; record the banner text.
5. Compare the two banners.

**Expected Result**

Both attempts are refused with the same generic banner "Invalid credentials".

**Actual result**

Correct password → "Account disabled"; wrong password → "Invalid credentials". Reproduced by the automated test TC-AUTH-UI-007 in this run.

---

## BUG-02

### `[/web/index.php/admin/saveSystemUser][Confirm Password reports "Passwords do not match" on an empty Add User form instead of "Required"]`

*Severity: Low–Medium · Traceability: TC-ADM-UI-013 · FR-ADM-1, NFR-UX · exploration D-03*

**Description**

Submitting an empty Add User form shows "Required" under User Role, Employee Name, Status, Username and Password, but Confirm Password shows "Passwords do not match" even though nothing was typed in either password field. The message describes a comparison failure that did not occur.

**Steps to reproduce**

1. Log in as Admin.
2. Go to Admin > User Management > Users and click Add.
3. Leave every field empty and click Save.
4. Read the validation message under each field.

**Expected Result**

Confirm Password shows "Required", consistent with its five sibling fields.

**Actual result**

Confirm Password shows "Passwords do not match"; the other five fields show "Required". Reproduced by TC-ADM-UI-013 in this run.

---

## BUG-03

### `[/web/index.php/api/v2/admin/users][error.status is a string in 404 and 422 bodies but an integer in 401 bodies]`

*Severity: Low · Traceability: TC-ADM-API-014 · FR-API-6, FR-API-7 · exploration D-05*

**Description**

The JSON type of error.status changes with the status class: a string in 404 and 422 bodies, an integer in 401 bodies. A strict schema or typed client model validates one class of error and fails on the other.

**Steps to reproduce**

1. With an Admin session: GET /web/index.php/api/v2/admin/users/999999 and record the body.
2. With an Admin session: GET /web/index.php/api/v2/admin/users?sortField=bogusField and record the body.
3. Without a session: GET /web/index.php/api/v2/admin/users and record the body.
4. Compare the type of error.status.

**Expected Result**

error.status uses one JSON type in every error response.

**Actual result**

404 → "404" (string); 422 → "422" (string); 401 → 401 (integer). Reproduced by TC-ADM-API-014 in this run.

---

## BUG-04

### `[/web/index.php/auth/requestResetPassword][Password reset for an existing username times out with HTTP 504 while an unknown username returns 302 immediately, disclosing which accounts exist]`

*Severity: High · Traceability: TC-AUTH-UI-020, TC-AUTH-UI-022 · FR-AUTH-5, NFR-SEC · Healing INC-01 · NEW in this run*

**Description**

Submitting the Reset Password form for an existing username leaves the request pending for about 60 s and then returns HTTP 504 Gateway Timeout; the user never reaches the "Reset Password link sent successfully" screen. For a non-existent username the same form returns 302 to /auth/sendPasswordReset in about 300 ms. Valid users cannot complete the reset flow, and the difference in status code and response time reveals whether a username exists (user enumeration).

**Steps to reproduce**

1. Log out and open /web/index.php/auth/requestPasswordResetCode.
2. Enter NoSuchUser9901 and click Reset Password; record the status and time of POST /web/index.php/auth/requestResetPassword.
3. Return to the reset screen, enter an existing username and click Reset Password; record the status and time again.
4. Compare the two responses.

**Expected Result**

Both submissions return the same 302 to /auth/sendPasswordReset in normal response time and show "Reset Password link sent successfully".

**Actual result**

Unknown username → 302 in about 310 ms with the confirmation screen. Existing username → 504 Gateway Timeout after about 60,125 ms and no confirmation screen.

---

## BUG-05

### `[/web/index.php/api/v2/admin/users][POST creating a user returns HTTP 200 instead of 201 Created]`

*Severity: Low · Traceability: TC-ADM-API-016 · FR-API-10 · exploration D-04 · NEW in this run*

**Description**

POST /api/v2/admin/users creates a new system user and returns the persisted record, but answers with HTTP 200 instead of 201 Created. OrangeHRM's own Professional API documents 201 for the equivalent call, and clients that branch on 201 to detect creation will mis-handle the response.

**Steps to reproduce**

1. Log in as Admin to hold the orangehrm session cookie.
2. POST /web/index.php/api/v2/admin/users with {"username":"<unique>","password":"qaProbe1","status":true,"userRoleId":2,"empNumber":<existing>}.
3. Record the HTTP status code.
4. Delete the created user.

**Expected Result**

HTTP 201 Created, with the new record in the body.

**Actual result**

HTTP 200 OK, with the new record in the body. Reproduced by TC-ADM-API-016 in this run.

---

## BUG-06

### `[/web/index.php/api/v2/admin/users][Username with leading or trailing spaces is stored as-is instead of being trimmed]`

*Severity: Low–Medium · Traceability: TC-ADM-API-043 · FR-ADM-2 · Healing INC-05 · NEW in this run*

**Description**

Creating a user through the API with a username wrapped in spaces succeeds and stores the spaces as part of the username. Usernames that differ only by surrounding whitespace look identical on screen, which creates confusing, look-alike accounts and makes the stored login name differ from what the administrator sees.

**Steps to reproduce**

1. Log in as Admin to hold the orangehrm session cookie.
2. POST /web/index.php/api/v2/admin/users with {"username":" qatrimUser1 ","password":"qaProbe1","status":true,"userRoleId":2,"empNumber":<existing>}.
3. Read data.userName in the response.
4. Delete the created user.

**Expected Result**

The username is trimmed on creation (stored as "qatrimUser1"), or the request is rejected with 422 naming "username".

**Actual result**

HTTP 200; data.userName is " qatrimUser1 " with the leading and trailing spaces kept. Reproduced by TC-ADM-API-043 in this run.

---

*Generated from the automated run of 2026-10-13. The same reports, with identical IDs, appear in section 3 of the Automation Execution Summary.*
