# Defect Reports — 2026-10-20

| Field | Value |
|---|---|
| **Run** | Manual execution, 2026-10-20 |
| **Scope** | Authentication (AUTH) + Admin / User Management (ADM), UI and API, 100 in-scope test cases |
| **Environment** | OrangeHRM OS 5.9, shared public demo https://opensource-demo.orangehrmlive.com/ |
| **Defects** | 7 (one per failed test case) |
| **Also published in** | `Execution_Summary_2026-10-20.html`, section 3 "Defect Reports" (same IDs and content) |

All reports are in English and follow the `[EndPoint][Title]` naming convention.

---

## BUG-01

### `[/web/index.php/auth/validate][Disabled account returns "Account disabled" instead of the generic "Invalid credentials", disclosing account state and password correctness]`

- **Severity:** Medium–High
- **Traceability ID:** TC-AUTH-UI-007 (contrast case TC-AUTH-UI-008) · FR-AUTH-3, NFR-SEC · exploration D-02 · also reported as BUG-01 in the 2026-10-14 runs

**Description**

The login endpoint gives two different rejection messages. A disabled account submitted with its correct password is refused with "Account disabled". The same kind of account submitted with a wrong password is refused with "Invalid credentials". Anyone can therefore confirm that a username exists, that it is disabled, and that a guessed password is correct.

**Steps to reproduce**

1. Sign in as Admin and create a test user with POST /web/index.php/api/v2/admin/users and the body {"username":"<unique>","password":"qaProbe1","status":false,"userRoleId":2,"empNumber":3}, so the account is disabled.
2. In a new private browser window, open /web/index.php/auth/login.
3. Enter the new username and its correct password "qaProbe1", then click Login.
4. Note the error banner.
5. Repeat with the same username and a wrong password, for example "totallyWrong1".
6. Delete the test user afterwards (DELETE /web/index.php/api/v2/admin/users with {"ids":[<id>]}).

**Expected Result**

Both attempts are refused with the same generic banner "Invalid credentials". Nothing reveals whether the account exists, is disabled, or whether the password was correct.

**Actual result**

Reproduced on 2026-10-20 at 07:40 UTC with the disabled account qadismvgdjafhtas. The correct password produced the banner "Account disabled" (POST /auth/validate → 302 → /auth/login). The wrong password produced "Invalid credentials" (TC-AUTH-UI-008). The disabled user still cannot sign in, but the message reveals the account's state.

---

## BUG-02

### `[/web/index.php/admin/saveSystemUser][Empty Add User form shows "Passwords do not match" under Confirm Password instead of "Required"]`

- **Severity:** Low–Medium
- **Traceability ID:** TC-ADM-UI-013 · FR-ADM-1, NFR-UX · exploration D-03

**Description**

Clicking Save on an empty Add User form marks User Role, Employee Name, Status, Username and Password as "Required". Confirm Password instead says "Passwords do not match", although nothing has been typed into either password field. The message is misleading and inconsistent with the other five fields.

**Steps to reproduce**

1. Sign in as Admin.
2. Open Admin > User Management > Users and click Add (/web/index.php/admin/saveSystemUser).
3. Leave every field empty and click Save.
4. Read the message under each field.

**Expected Result**

Confirm Password shows "Required", like its five sibling fields.

**Actual result**

Reproduced on 2026-10-20 at 07:43 UTC: Confirm Password showed "Passwords do not match", while User Role, Employee Name, Status, Username and Password showed "Required". No request was sent.

---

## BUG-03

### `[/web/index.php/admin/viewSystemUsers][Row Edit and Delete icon buttons have no accessible name]`

- **Severity:** Medium
- **Traceability ID:** TC-ADM-UI-033 · NFR-UX (accessibility) · exploration §2.1 automation hazard

**Description**

Each row of the System Users list has two icon-only buttons, Delete (trash) and Edit (pencil). Neither button has an aria-label, a title or any text, so screen readers announce them only as "button". Assistive technology cannot tell the actions apart, and test automation cannot select them by name.

**Steps to reproduce**

1. Sign in as Admin and open /web/index.php/admin/viewSystemUsers.
2. Inspect the two buttons inside .oxd-table-cell-actions of any row.
3. Check each button's accessible name (aria-label, title or text content), for example in the browser's accessibility panel.

**Expected Result**

Each action button exposes a distinct accessible name, for example "Delete user" and "Edit user".

**Actual result**

Reproduced on 2026-10-20 at 07:56 UTC: both buttons have an empty accessible name (no aria-label, no title, no text); only the icon (i.bi-trash / i.bi-pencil-fill) tells them apart visually.

---

## BUG-04

### `[/web/index.php/api/v2/admin/users][error.status is a string in 404/422 error bodies but an integer in 401 error bodies]`

- **Severity:** Low
- **Traceability ID:** TC-ADM-API-014 · FR-API-6 · exploration D-05

**Description**

The API's error envelope is not consistently typed. Not-found and validation errors return error.status as a JSON string, while the unauthenticated error returns it as a JSON number. A client that validates or compares error.status with one type will mishandle the other errors.

**Steps to reproduce**

1. As Admin, call GET /web/index.php/api/v2/admin/users/999999 and note the type of error.status.
2. As Admin, call GET /web/index.php/api/v2/admin/users?limit=50&offset=0&sortField=bogusField&sortOrder=ASC and note the type of error.status.
3. Without a session cookie, call GET /web/index.php/api/v2/admin/users?limit=2&offset=0 and note the type of error.status.

**Expected Result**

error.status has the same JSON type (for example an integer) in every error response.

**Actual result**

Reproduced on 2026-10-20 at 07:57 UTC: 404 → {"error":{"status":"404","message":"Record Not Found"}} (string); 422 → "status":"422" (string); 401 → {"error":{"status":401,"message":"Session expired"}} (integer).

---

## BUG-05

### `[/web/index.php/api/v2/admin/users][Creating a user returns HTTP 200 instead of 201 Created]`

- **Severity:** Low
- **Traceability ID:** TC-ADM-API-016 · FR-API-10 · exploration D-04

**Description**

POST /web/index.php/api/v2/admin/users creates a new system user and returns the new record, but the response status is 200 OK rather than 201 Created. Clients that rely on standard HTTP semantics cannot tell a creation from any other successful call. OrangeHRM's own Professional API documents 201 for the equivalent call.

**Steps to reproduce**

1. Sign in as Admin.
2. Call POST /web/index.php/api/v2/admin/users with Content-Type application/json and the body {"username":"<unique>","password":"qaProbe1","status":true,"userRoleId":2,"empNumber":3}.
3. Note the HTTP status code and the returned id.
4. Delete the created user afterwards.

**Expected Result**

HTTP 201 Created with the persisted record.

**Actual result**

Reproduced on 2026-10-20 at 07:57 UTC: HTTP 200 with the new record (id 199). The user was created and then deleted by the test.

---

## BUG-06

### `[/web/index.php/api/v2/admin/users][Leading and trailing spaces in a new username are stored, so the user cannot sign in with the trimmed name]`

- **Severity:** Medium
- **Traceability ID:** TC-ADM-API-043 · FR-ADM-2, FR-AUTH-2 · reported as BUG-06 in the 2026-10-13 automated run

**Description**

When a user is created with spaces around the username, the API stores the value as typed, spaces included, instead of trimming it. The account then cannot sign in with the visible (trimmed) username. It also allows usernames that look identical but differ only by whitespace.

**Steps to reproduce**

1. Sign in as Admin.
2. Call POST /web/index.php/api/v2/admin/users with {"username":" <unique> ","password":"qaProbe1","status":true,"userRoleId":2,"empNumber":3} (note the spaces).
3. Note data.userName in the response.
4. In a new private window, sign in at /web/index.php/auth/login with "<unique>" (no spaces) and "qaProbe1".
5. Delete the created user afterwards.

**Expected Result**

The API trims the username on creation (data.userName = "<unique>"), and signing in with the trimmed name succeeds.

**Actual result**

Reproduced on 2026-10-20 at 07:57 UTC: the response stored userName " qaspcmvge3zbs9yd " with the spaces. Signing in with "qaspcmvge3zbs9yd" was refused with "Invalid credentials".

---

## BUG-07

### `[/web/index.php/auth/requestResetPassword][Password reset for an existing username fails with HTTP 504 Gateway Time-out after about 60 seconds]`

- **Severity:** High
- **Traceability ID:** TC-AUTH-UI-020 · FR-AUTH-5 · also reported as BUG-02 in the 2026-10-14 manual run and BUG-04 in the 2026-10-13 automated run

**Description**

Submitting the Reset Password form for an existing username leaves the request pending for about 60 seconds, then nginx returns 504 Gateway Time-out. The user never reaches the confirmation screen, so no real user can complete a password reset.

**Steps to reproduce**

1. Make sure a username exists, for example create an enabled test user through Admin > User Management > Users > Add.
2. Sign out and open /web/index.php/auth/requestPasswordResetCode.
3. Enter the existing username and click Reset Password.
4. Wait for the response and note the status code, the time taken and the page shown.
5. Delete the test user afterwards.

**Expected Result**

The POST returns 302 to /web/index.php/auth/sendPasswordReset within normal response time, and the "Reset Password link sent successfully" screen is shown.

**Actual result**

Reproduced on 2026-10-20 at 08:04 UTC with user qaresetmvgedqyt7do: POST /auth/requestResetPassword returned HTTP 504 after 60.2 s, and the browser showed the nginx/1.18.0 "504 Gateway Time-out" page. No confirmation screen was shown.

---

