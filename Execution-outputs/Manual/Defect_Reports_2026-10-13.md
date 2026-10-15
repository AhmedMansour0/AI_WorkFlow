# Defect Reports — 2026-10-13

| Field | Value |
|---|---|
| **Run date** | 2026-10-13 |
| **Scope** | Authentication (Login) + Admin / User Management — UI and API |
| **System under test** | OrangeHRM OS 5.9 — `https://opensource-demo.orangehrmlive.com/` |
| **Evidence source** | `Project-Documents/exploration.md` (live exploration, 2026-10-12) |
| **Test design** | `Project-Documents/Test_Cases.csv` — 50 in-scope cases executed |
| **Defects raised** | 3 (one per failing test case) |
| **Companion report** | `Execution-outputs/Manual/Execution_Summary_2026-10-13.html` |

---

## BUG-01

### `[/web/index.php/auth/validate][Disabled account returns "Account disabled" instead of the generic "Invalid credentials", disclosing account state and password correctness]`

*Severity: Medium–High · Traceability: TC-AUTH-UI-007 · FR-AUTH-3, NFR-SEC · exploration D-02 (§1.3 A5, §3.7)*

**Description**

The login endpoint produces two distinguishable rejection messages. A **disabled** account submitted with its **correct** password is refused with the banner `Account disabled`, while the same account submitted with a wrong password is refused with `Invalid credentials`. The difference turns the login form into an oracle: an unauthenticated attacker can confirm both that a given username exists and that a guessed password is correct, even though the account cannot be used to sign in. This contradicts the FR-AUTH-3 acceptance criterion that authentication is refused "without disclosing which field was wrong", and it defeats the purpose of the generic-message design applied everywhere else on the screen.

**Steps to reproduce**

1. Sign in as `Admin` / `admin123` and create a test user — `POST /web/index.php/api/v2/admin/users` with body `{"username":"qaprobe9901","password":"qaProbe1","status":true,"userRoleId":2,"empNumber":3}` (or Admin > User Management > Users > Add).
2. Disable that user — `PUT /web/index.php/api/v2/admin/users/{id}` with body `{"username":"qaprobe9901","password":"","status":false,"userRoleId":2,"empNumber":3,"changePassword":false}` (or set Status to `Disabled` on the Edit User form).
3. Open a clean browser context with no existing session and navigate to `/web/index.php/auth/login`.
4. Enter username `qaprobe9901` and the **correct** password `qaProbe1`, then click **Login**. Record the text of the `.oxd-alert.oxd-alert--error` banner.
5. Repeat steps 3–4 with an **incorrect** password, for example `totallyWrong1`. Record the banner text again.
6. Compare the two recorded banner texts.

**Expected Result**

Both attempts are refused with the identical generic banner `Invalid credentials`, and the response is indistinguishable in message, status code and `Location` header. Nothing in the response reveals whether the username exists, whether the account is disabled, or whether the submitted password was correct.

**Actual result**

The two attempts are distinguishable. Step 4 (correct password, disabled account) returns the banner `Account disabled`. Step 5 (wrong password, same account) returns `Invalid credentials`. The disabled account is therefore confirmed to exist, and the correct password is confirmed to be correct, from the login screen alone with no authenticated session. The functional half of the control works correctly — the disabled user genuinely cannot sign in — but the messaging leaks account state.

---

## BUG-02

### `[/web/index.php/admin/saveSystemUser][Confirm Password reports "Passwords do not match" on an empty Add User form instead of "Required"]`

*Severity: Low–Medium · Traceability: TC-ADM-UI-013 · FR-ADM-1, NFR-UX · exploration D-03 (§2.3)*

**Description**

Submitting a completely empty Add User form surfaces required-field validation on every control, but the `Confirm Password` field reports the wrong rule. Its five sibling fields — User Role, Employee Name, Status, Username and Password — all correctly display `Required`, while Confirm Password displays `Passwords do not match`. Nothing has been typed into either password field at that point, so the message states a comparison failure that did not occur. It misdirects the user toward re-checking a value they never entered, and it breaks the consistency of the form's own validation vocabulary.

**Steps to reproduce**

1. Sign in as `Admin` / `admin123`.
2. Navigate to **Admin > User Management > Users** and click **Add**.
3. Leave every field on the Add User form empty — do not type into Password or Confirm Password.
4. Click **Save**.
5. Read the message rendered in `.oxd-input-field-error-message` beneath each of the six fields.

**Expected Result**

Confirm Password displays `Required`, consistent with the five sibling fields on the same form, since the field is empty and no comparison is possible. The user is not created.

**Actual result**

Confirm Password displays `Passwords do not match`. The other five fields correctly display `Required`. The user is correctly not created, so the defect is confined to the message text, but the field reports a mismatch between two values that were never supplied.

---

## BUG-03

### `[/web/index.php/api/v2/admin/users][error.status is a string in 404 and 422 bodies but an integer in 401 bodies]`

*Severity: Low · Traceability: TC-ADM-API-014 · FR-API-6, FR-API-7 · exploration D-05 (§3.3)*

**Description**

The API error envelope is structurally consistent — every error response carries `error.status` and `error.message` — but the JSON data type of `error.status` changes with the status class. The `404` and `422` bodies quote it as a string (`"404"`, `"422"`), while the `401` body returns it as a bare integer (`401`). A client or test suite that deserialises the error envelope into a typed model, or that asserts the error schema strictly, will succeed against one class of error and fail against the other. Integrators are forced to write a type-tolerant parser for a field that should be a single type across the contract.

**Steps to reproduce**

1. Sign in as `Admin` / `admin123` so the `orangehrm` session cookie is held.
2. Request a non-existent record — `GET /web/index.php/api/v2/admin/users/999999` — and record the raw response body.
3. Request an invalid parameter — `GET /web/index.php/api/v2/admin/users?limit=50&offset=0&sortField=bogusField&sortOrder=ASC` — and record the raw response body.
4. Sign out via `/web/index.php/auth/logout`, then replay any `GET /web/index.php/api/v2/admin/users` call with the now-invalid cookie and record the raw response body.
5. Compare the JSON type of `error.status` across the three bodies.

**Expected Result**

`error.status` uses one consistent JSON type in every error response, so a single strict schema — and a single deserialisation model — validates all of them.

**Actual result**

The type changes with the status class:

- `404` → `{"error":{"status":"404","message":"Record Not Found"}}` — string
- `422` → `{"error":{"status":"422","message":"Invalid Parameter","data":{"invalidParamKeys":["sortField"]}}}` — string
- `401` → `{"error":{"status":401,"message":"Session expired"}}` — integer

A strict schema assertion passes against the 404/422 pair and fails against the 401, or the reverse.

---

*Prepared 2026-10-13 from the execution evidence recorded in `Project-Documents/exploration.md`. Three of the 50 in-scope test cases failed; each failure is reported above. Nineteen further cases could not be evaluated from the available evidence and are listed as Blocked in the execution summary.*
