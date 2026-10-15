# UI & API Exploration Report — OrangeHRM

| Field | Value |
|---|---|
| **Scope** | Authentication (Login) + Admin (User Management) — UI and API |
| **UI target** | `https://opensource-demo.orangehrmlive.com/` |
| **API doc target** | `https://api.orangehrm.com/` |
| **Build observed** | OrangeHRM OS 5.9 (footer string) |
| **Traces to** | `PRD.md` §2, §3.1 (`FR-AUTH-1..8`), §3.3 (`FR-ADM-1..3`), §3.13 (`FR-API-*`), §4.2 (`NFR-SEC`) |
| **Explored by** | QA Engineering |
| **Date** | 2026-10-12 |
| **Method** | Live browser automation (Playwright/Chromium) — DOM capture, network interception, and direct `fetch` against the authenticated session |

### How to read this document

- **Observed** = reproduced directly in this session, with the evidence shown inline.
- **Not exercised** = in scope but not reachable with the access available; listed in §7 so it is not silently dropped.
- **Deviations** (§6) are numbered `D-nn` and are *candidates* for the bug-reporting phase, not confirmed defects. Each names the PRD clause it contradicts.

> **Test-data warning.** The demo is a shared, publicly-credentialled instance. The user list changed from 11 to 12 records mid-session (`Surya99` appeared) with no action from this exploration. Treat every record count and user ID below as volatile — see `D-10`.

---

## 1. Authentication — UI

### 1.1 Login screen

`GET /web/index.php/auth/login`

The page is a Vue SPA using the **OXD** component library (`oxd-*` class prefix). The login form itself is a conventional server-rendered `<form>` POST — *not* an XHR call.

```html
<form action="/web/index.php/auth/validate" method="post">
  <input type="hidden"   name="_token"   value="39.4dhsM697afmPfayP_-EiIhGDAOoFzB2GjCvKHfZcMpw.hZEqX...">
  <input type="text"     name="username" placeholder="Username" class="oxd-input oxd-input--focus">
  <input type="password" name="password" placeholder="Password" class="oxd-input oxd-input--active">
  <button type="submit" class="oxd-button oxd-button--medium oxd-button--main orangehrm-login-button">Login</button>
</form>
```

Key observations:

- Inputs carry **no `id`, no label association, and no `required` attribute**. All validation is client-side JavaScript. There is no HTML5 constraint validation to lean on.
- A per-render CSRF token `_token` is embedded as a hidden field.
- The demo credentials are printed on the page itself (`.orangehrm-demo-credentials`): `Admin` / `admin123`.
- Footer renders the version string `OrangeHRM OS 5.9` — satisfies the version-in-footer clause of `FR-AUTH-1`.

### 1.2 Locator reference — login

Because the fields have no stable `id`, automation must anchor on `name` or on role/placeholder.

| Element | Recommended locator | Notes |
|---|---|---|
| Username field | `input[name="username"]` | Also `getByRole('textbox', { name: 'Username' })` |
| Password field | `input[name="password"]` | |
| Login button | `button[type="submit"]` | Also `getByRole('button', { name: 'Login' })` |
| CSRF token | `input[name="_token"]` | Hidden; regenerated per page render |
| Field-level error | `.oxd-input-field-error-message` | Scope to the parent `.oxd-input-group` |
| Field in error state | `input.oxd-input--error` | Class is toggled on the input itself |
| Banner error | `.oxd-alert.oxd-alert--error .oxd-alert-content-text` | Carries `role="alert"` |
| Forgot-password link | `.orangehrm-login-forgot` | Rendered as a `<p>`, **not** an `<a>` |
| Version footer | `.orangehrm-login-footer` | |

### 1.3 Observed authentication behaviours

| # | Scenario | Observed result | PRD |
|---|---|---|---|
| A1 | Submit with both fields empty | **No network request is made.** Client-side validation renders `Required` under both fields; both inputs gain `oxd-input--error`. | `FR-AUTH-4` ✅ |
| A2 | Valid username, wrong password | `POST /auth/validate` → **302** → `Location: /auth/login`. Re-rendered page shows banner **`Invalid credentials`**. | `FR-AUTH-3` ✅ |
| A3 | Valid credentials | `POST /auth/validate` → **302** → redirect to the authenticated area. | `FR-AUTH-2` ⚠️ see `D-01` |
| A4 | Protected URL while logged out | `GET /admin/viewSystemUsers` → **302** → `/auth/login`. No API calls fire. | `FR-AUTH-6` ✅ |
| A5 | Disabled account, correct password | Banner reads **`Account disabled`** — a *different* message from A2. | `FR-AUTH-3` ❌ see `D-02` |
| A6 | Logout | `GET /auth/logout` → **302** → `/auth/login`. **Session cookie value is rotated** (`jah04e38kar7...` → `76q6hqp6fvuk...`). | `FR-AUTH-7` ✅ |
| A7 | Browser Back after logout | Lands on `/auth/login`; the username input is present. Authenticated content is **not** restored. | `FR-AUTH-7` ✅ |
| A8 | API call with post-logout cookie | **401** `{"error":{"status":401,"message":"Session expired"}}` | `FR-AUTH-7`, `FR-API-8` ✅ |
| A9 | Login POST replayed with a tampered `_token` | **302** → `/auth/login`, not authenticated. CSRF protection is enforced. | `NFR-SEC` ✅ |

**Login request wire format** (`Content-Type: application/x-www-form-urlencoded`):

```
POST /web/index.php/auth/validate

_token=39.4dhsM697afmPfayP_-EiIhGDAOoFzB2GjCvKHfZcMpw.hZEqX...&username=Admin&password=admin123
```

The response is **always a 302** — success and failure are distinguished only by the `Location` header. There is no JSON login endpoint.

### 1.4 Forgot password

`GET /web/index.php/auth/requestPasswordResetCode` — reached from the login screen.

```html
<form action="/web/index.php/auth/requestResetPassword" method="post">
  <input type="hidden" name="_token" ...>
  <input type="text"   name="username" placeholder="Username" class="oxd-input oxd-input--active">
</form>
```

- Heading: `Reset Password`. Single `Username` field.
- Two buttons: `Cancel` (`type="button"`, class `...--cancel`) and `Reset Password` (`type="submit"`, class `...--reset`).
- Satisfies `FR-AUTH-5`. The reset email delivery itself is out of reach on the demo and was not exercised.

### 1.5 Session cookie and security headers (`NFR-SEC`)

```json
{
  "name": "orangehrm",
  "domain": "opensource-demo.orangehrmlive.com",
  "path": "/web",
  "httpOnly": true,
  "secure": true,
  "sameSite": "Lax",
  "expires": -1
}
```

- `document.cookie` returns an **empty string** — the session cookie is correctly invisible to script.
- Session-scoped (no `Expires`), path-scoped to `/web`.

| Header | Value |
|---|---|
| `strict-transport-security` | `max-age=63072000; includeSubdomains;` |
| `x-content-type-options` | `nosniff` |
| `x-xss-protection` | `1; mode=block` |
| `content-security-policy` | present, but includes **`'unsafe-inline' 'unsafe-eval'`** |
| `x-frame-options` | **absent** |
| `referrer-policy` | **absent** |
| `public-key-pins` | present (deprecated header, ignored by modern browsers) |

---

## 2. Admin → User Management — UI

### 2.1 User list

`GET /web/index.php/admin/viewSystemUsers`

Breadcrumb renders as two `<h6>` elements: `Admin` / `/ User Management`. Topbar tabs: **User Management · Job · Organization · More**.

The list is **not a `<table>` of `<tr>`/`<td>`** — it is a div grid with ARIA table semantics. Each row renders its column header *inside* the cell (`cell "Username Admin"`), which matters for locator design.

| Element | Recommended locator |
|---|---|
| Records-found counter | `.oxd-text:has-text("Records Found")` → e.g. `(11) Records Found` |
| Add button | `button:has-text("Add")` |
| Filter panel toggle | `.oxd-table-filter-header-options button` |
| Row container | `.oxd-table-card` |
| Row cell | `.oxd-table-cell` (index 1=Username, 2=User Role, 3=Employee Name, 4=Status) |
| Row Edit / Delete | `.oxd-table-cell-actions button` (icon-only, **no accessible name** — index-based) |
| Filter: Username | `.oxd-input-group:has(label:text("Username")) input` |
| Filter: User Role | `.oxd-input-group:has(label:text("User Role")) .oxd-select-text` |
| Filter: Employee Name | `.oxd-input-group:has(label:text("Employee Name")) input` — autocomplete, placeholder `Type for hints...` |
| Filter: Status | `.oxd-input-group:has(label:text("Status")) .oxd-select-text` |
| Search / Reset | `button[type="submit"]:has-text("Search")` / `button:has-text("Reset")` |

**Automation hazard:** the row Edit and Delete buttons are icon-only `<button>` elements with empty text and no `aria-label`. They cannot be selected by accessible name and must be reached positionally within `.oxd-table-cell-actions`. Flag this for the automation phase.

The filter panel exposes exactly the four fields `FR-ADM-1` requires (user role, employee name, username, status).

### 2.2 Add / Edit user form

`GET /web/index.php/admin/saveSystemUser` (add) · `/admin/saveSystemUser/{id}` (edit)

| Label | Control | Notes |
|---|---|---|
| User Role | `oxd-select` custom dropdown | Options: `Admin`, `ESS` |
| Employee Name | text + autocomplete | Placeholder `Type for hints...` |
| Status | `oxd-select` custom dropdown | Options: `Enabled`, `Disabled` |
| Username | text, `autocomplete="off"` | Async uniqueness check |
| Password | password, `autocomplete="off"` | Add mode only |
| Confirm Password | password, `autocomplete="off"` | Add mode only |

In **edit** mode the form additionally renders a `Change Password ?` toggle, and the Password / Confirm fields are hidden until it is switched on. The heading becomes `Edit User`.

None of the inputs carry a `name` or `id`. Every field must be located through its `.oxd-input-group` label. The custom `oxd-select` is **not** a `<select>` — `selectOption()` will not work; it must be clicked open and the `.oxd-select-option` chosen.

### 2.3 Validation rules observed

Submitting the Add form empty produces:

| Field | Message |
|---|---|
| User Role | `Required` |
| Employee Name | `Required` |
| Status | `Required` |
| Username | `Required` |
| Password | `Required` |
| Confirm Password | **`Passwords do not match`** ← see `D-03` |

**Username rules**

| Input | Result |
|---|---|
| `ab` (2 chars) | `Should be at least 5 characters` |
| `abcde` (5 chars) | accepted |
| `Admin` (existing) | `Already exists` — async, via the validation endpoint in §3.4 |

**Password policy** — derived by probing each boundary:

| Input | Message |
|---|---|
| `abc` | `Should have at least 7 characters` |
| `abcde1` (6) | `Should have at least 7 characters` |
| `abcdef1` (7) | accepted |
| `abcdefgh` (8, lowercase only) | `Your password must contain minimum 1 number` |
| `ABCDEFG1` (no lowercase) | `Your password must contain minimum 1 lower-case letter` |
| `1234567` (digits only) | `Your password must contain minimum 1 lower-case letter` |

**Effective policy: ≥ 7 characters, ≥ 1 digit, ≥ 1 lower-case letter.** No upper-case, symbol, or dictionary requirement — `abcdef1` is accepted. This fully specifies the `FR-ADM-2` password policy, which the PRD left unstated.

> **Automation note.** Field validation is **debounced**. A probe that types a value and reads the error immediately gets the *previous* value's message. Every assertion on `.oxd-input-field-error-message` must wait for the message to settle (~1–2 s after `blur`), or it will assert against stale text. This produced a reproducible one-step lag during this exploration and will cause flaky tests if ignored. See `D-09`.

---

## 3. REST API v2 — Admin / User Management

Base: `https://opensource-demo.orangehrmlive.com/web/index.php/api/v2`
Auth: the `orangehrm` session cookie (`credentials: 'include'`). Confirms `FR-API-11`.

### 3.1 `GET /admin/users` — list

The UI issues exactly this on page load:

```
GET /api/v2/admin/users?limit=50&offset=0&sortField=u.userName&sortOrder=ASC
```

Response (`200`), truncated to two records:

```json
{
  "data": [
    {
      "id": 1,
      "userName": "Admin",
      "deleted": false,
      "status": true,
      "employee": {
        "empNumber": 7,
        "employeeId": "muser",
        "firstName": "manda",
        "middleName": "akhil",
        "lastName": "user",
        "terminationId": null
      },
      "userRole": { "id": 1, "name": "Admin", "displayName": "Admin" }
    },
    {
      "id": 57,
      "userName": "aNwDnmNlAB",
      "deleted": false,
      "status": true,
      "employee": {
        "empNumber": 170,
        "employeeId": "680467",
        "firstName": "Britt",
        "middleName": "Lacie Tremblay Howe II",
        "lastName": "Frami",
        "terminationId": null
      },
      "userRole": { "id": 2, "name": "ESS", "displayName": "ESS" }
    }
  ],
  "meta": { "total": 11 },
  "rels": []
}
```

Confirms the `data` / `meta` / `rels` envelope (`FR-API-3`) and `meta.total` as the unfiltered total (`FR-API-4`).

**Query parameters verified**

| Parameter | Example | Result |
|---|---|---|
| `limit` / `offset` | `?limit=2&offset=0` | 2 records returned, `meta.total` stays `11` ✅ |
| `username` | `?username=Admin` | 1 record, `meta.total: 1` |
| `userRoleId` | `?userRoleId=1` | 2 records (`Admin`, `kathir@12`) |
| `status` | `?status=false` | `{"data":[],"meta":{"total":0}}` — no disabled users at the time |
| `sortField` / `sortOrder` | `u.userName` / `ASC` | ✅ — note the **`u.` table-alias prefix**, unlike PIM's `employee.firstName` |

Role IDs are stable and usable as test constants: **`1` = Admin, `2` = ESS**.

### 3.2 `GET /admin/users/{id}` — single record

`GET /admin/users/1` → `200`. Same object shape, but with `meta` as an **empty array** `[]` rather than an object:

```json
{ "data": { "id": 1, "userName": "Admin", "...": "..." }, "meta": [], "rels": [] }
```

### 3.3 Error contracts

| Request | Status | Body |
|---|---|---|
| `GET /admin/users/999999` | **404** | `{"error":{"status":"404","message":"Record Not Found"}}` |
| `GET /admin/users?sortField=bogusField` | **422** | `{"error":{"status":"422","message":"Invalid Parameter","data":{"invalidParamKeys":["sortField"]}}}` |
| `GET /admin/users` (unauthenticated) | **401** | `{"error":{"status":401,"message":"Session expired"}}` |

Note the inconsistency: `status` is a **string** (`"404"`) in the 404/422 bodies but an **integer** (`401`) in the 401 body. A strict schema assertion will fail against one or the other. See also `D-05` on the 404-vs-422 divergence from the PRD.

### 3.4 `GET /admin/validation/user-name` — async uniqueness

Undocumented in the PRD. Fired by the Add-User form while typing in the Username field.

```
GET /api/v2/admin/validation/user-name?userName=Admin
→ 200  {"data":{"valid":false},"meta":[],"rels":[]}

GET /api/v2/admin/validation/user-name?userName=qaprobe9901
→ 200  {"data":{"valid":true},"meta":[],"rels":[]}
```

Returns `200` in both cases; the verdict is carried in `data.valid`. This endpoint discloses whether an arbitrary username exists — it requires an authenticated Admin session, so it is not an unauthenticated enumeration vector, but it warrants a negative authorisation test.

### 3.5 Employee autocomplete

Backs the `Employee Name` field on both the filter panel and the Add/Edit form:

```
GET /api/v2/pim/employees?nameOrId=Pe&includeEmployees=onlyCurrent
→ 200
{"data":[{"empNumber":3,"lastName":"Anderson","firstName":"Peter","middleName":"Mac","employeeId":"0007","terminationId":null}, ...],"meta":{"total":2},"rels":[]}
```

### 3.6 Write operations — `FR-API-10` resolved

> The PRD marks `FR-API-10` as `[ASSUMPTION]` because only `GET` traffic had been observed. **It is now verified.** A probe account was created, updated, and deleted; the account was removed at the end of this exploration and the list returned to its prior state.

**Create** — `POST /api/v2/admin/users`, `Content-Type: application/json`

```json
{ "username": "qaprobe9901", "password": "qaProbe1", "status": true, "userRoleId": 2, "empNumber": 3 }
```

→ **`200`** (not `201` — see `D-04`)

```json
{
  "data": {
    "id": 66,
    "userName": "qaprobe9901",
    "deleted": false,
    "status": true,
    "employee": { "empNumber": 3, "employeeId": "0007", "firstName": "Peter", "middleName": "Mac", "lastName": "Anderson", "terminationId": null },
    "userRole": { "id": 2, "name": "ESS", "displayName": "ESS" }
  },
  "meta": [],
  "rels": []
}
```

**Server-side validation is enforced independently of the UI** — all three below returned `422`:

| Payload defect | Response |
|---|---|
| Duplicate `username` | `{"error":{"status":"422","message":"Invalid Parameter","data":{"invalidParamKeys":["username"]}}}` |
| `"password": "abc"` (policy violation) | `{"...":"...","data":{"invalidParamKeys":["password"]}}` |
| `{ "username": "x" }` only | `{"...":"...","data":{"invalidParamKeys":["password","userRoleId","empNumber","status"]}}` |

This confirms `FR-ADM-2` is enforced at the API layer, not merely in the browser — the uniqueness and password rules cannot be bypassed by calling the API directly. Worth an explicit regression test.

**Update** — `PUT /api/v2/admin/users/{id}`. Captured from the UI's own traffic when toggling Status to `Disabled`:

```json
{ "username": "qaprobe9901", "password": "", "status": false, "userRoleId": 2, "empNumber": 3, "changePassword": false }
```

→ `200`, with `data.status` now `false`.

The `password` key is **mandatory even when `changePassword` is `false`**. Omitting it, or sending `null`, returns `422 invalidParamKeys: ["password"]`. The UI works around this by sending an empty string. See `D-06`.

**Delete** — `DELETE /api/v2/admin/users` (collection URL, IDs in the body — *not* `/users/{id}`):

```json
{ "ids": [66] }
```

→ `200` `{"data":["66"],"meta":[],"rels":[]}` — note the ID echoes back as a **string**.

A subsequent `GET /admin/users/66` returned `404 Record Not Found`, confirming the delete.

### 3.7 Account-disable enforcement (`FR-ADM-3`)

End-to-end chain, verified in an isolated browser context so the Admin session was unaffected:

1. `PUT /admin/users/66` with `status: false` → `200`.
2. Login as `qaprobe9901` / `qaProbe1` (the *correct* password) → rejected, banner **`Account disabled`**.
3. Login as `qaprobe9901` / `totallyWrong1` → rejected, banner **`Invalid credentials`**.

The functional half of `FR-ADM-3` passes — a disabled user genuinely cannot authenticate. The *messaging* half is the problem: steps 2 and 3 are distinguishable, which leaks account state. See `D-02`.

---

## 4. `https://api.orangehrm.com/` — developer portal

> **This section corrects the PRD.** `PRD.md` §"Source and Confidence" states the portal *"is a client-side rendered application that returns no readable content to a crawler."* That is accurate only for a plain HTTP fetch — a markdown extraction returned nothing. Under a **JavaScript-capable browser the portal renders completely**: ~1.5 MB of text, title `OrangeHRM apiDoc`, a full apiDoc-style endpoint reference. It was fully enumerated for this report. See `D-08`.

### 4.1 Applicability — the critical finding

The portal states, verbatim, under **Scope**:

> *"This documentation is intended for OrangeHRM Professional and Enterprise versions. OrangeHRM Open Source will not be supported by these APIs."*

This is a **different API** from the one the demo serves, not a superset of it:

| | Documented portal API | Open Source demo API |
|---|---|---|
| Base path | `/api/{resource}` | `/web/index.php/api/v2/{module}/{resource}` |
| User resource | `/api/systemUsers` | `/api/v2/admin/users` |
| Update verb | `PATCH` | `PUT` |
| Auth | OAuth 2.0 bearer token | Session cookie |
| Create response | `201` | `200` |
| Field naming | `snake_case` (`user_name`, `emp_number`) | `camelCase` (`userName`, `empNumber`) |

**Verified by probe** — every documented path returns `404` on the demo:

| Probe | Status |
|---|---|
| `/web/index.php/api/systemUsers` | 404 |
| `/api/systemUsers` | 404 |
| `/oauth/issueToken` | 404 |
| `/web/index.php/oauth/issueToken` | 404 |
| `/web/index.php/api/v2/admin/user-roles/assignable-lists` | 404 |

### 4.2 Documented OAuth flow (for reference — not testable on this build)

```
POST https://<system url>/oauth/issueToken
```

Accepts `form-data`, `json`, or `x-www-form-urlencoded`. Available from product version 6.3.8.

| Parameter | Purpose |
|---|---|
| `client_id` | Client ID of the API client |
| `client_secret` | Secret issued for that client ID |
| `grant_type` | `client_credentials` (public client) or `password` (private client) |
| `username` / `password` | Required for the `password` grant |

```json
{
  "access_token": "103827018a8d2b2e472bdc4de531f668e32da980",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "public"
}
```

Thereafter: `Authorization: Bearer <token>`. Token lifetime **3600 s**, which gives `FR-API-13`'s "bounded lifetime" a concrete value.

The portal's own User Guide places OAuth client registration at **Admin → Configuration → Authentication → OAuth Clients** — the PRD's `FR-ADM-17` says **Admin → Configuration → Register OAuth Client**, which is the Open Source screen name.

### 4.3 Documented System User endpoints (Professional / Enterprise)

| Method | Path |
|---|---|
| `GET` | `/api/systemUsers` |
| `GET` | `/api/systemUsers/:id` |
| `POST` | `/api/systemUsers` |
| `PATCH` | `/api/systemUsers/:id` |
| `GET` | `/api/systemUsers/:id/regions` |
| `PUT` | `/api/systemUsers/:id/regions` |
| `GET` | `/api/user-regions` |
| `GET` | `/api/userRoles/assignable-lists` |

`GET /api/systemUsers` supports a richer filter set than the OS build: `filter[userOrEmpNamePartial]`, `filter[uname]`, `filter[employeeId]`, `filter[essrole]`, `filter[supervisorrole]`, `filter[adminrole]`, `filter[status]`, `filter[location]`, `filter[includeDeleted]`, plus `include=Employee,UserUserRole,UserRole,Regions`, `orderField`, `orderBy`, `page[offset]`, `page[limit]`.

`POST /api/systemUsers` additionally exposes concepts **absent from Open Source**: `supervisorrole`, `adminrole`, `secondaryPassword`, `notifyEmployeeToSetPassword`, `allowEmptyPassword`, `secondaryPasswordEnabled`. Documented response codes include `201`, `400`, `401`, `403`, `422`.

---

## 5. Endpoint inventory — in-scope modules

| Method | Endpoint | Purpose | Status |
|---|---|---|---|
| `POST` | `/web/index.php/auth/validate` | Login (form POST, always 302) | Verified |
| `GET` | `/web/index.php/auth/login` | Login screen | Verified |
| `GET` | `/web/index.php/auth/logout` | Logout, rotates session cookie | Verified |
| `GET` | `/web/index.php/auth/requestPasswordResetCode` | Reset request screen | Verified |
| `POST` | `/web/index.php/auth/requestResetPassword` | Reset submission | Form captured, not submitted |
| `GET` | `/api/v2/admin/users` | List users (+ filters, paging, sort) | Verified |
| `GET` | `/api/v2/admin/users/{id}` | Single user | Verified |
| `POST` | `/api/v2/admin/users` | Create user → `200` | Verified |
| `PUT` | `/api/v2/admin/users/{id}` | Update / enable / disable → `200` | Verified |
| `DELETE` | `/api/v2/admin/users` | Delete by `{"ids":[...]}` → `200` | Verified |
| `GET` | `/api/v2/admin/validation/user-name?userName=` | Async uniqueness check | Verified — **not in PRD** |
| `GET` | `/api/v2/pim/employees?nameOrId=&includeEmployees=` | Employee autocomplete | Verified |
| `GET` | `/web/index.php/core/i18n/messages` | i18n bundle, loaded on every page | Observed |

---

## 6. Deviations and defect candidates

| ID | Severity | Observation | Contradicts |
|---|---|---|---|
| **D-01** | Low / PRD correction | Login does **not** always land on `/dashboard/index`. Requesting `/admin/viewSystemUsers` while logged out, then authenticating, redirected straight to `/admin/viewSystemUsers`. The app preserves the intended destination — sensible behaviour, but the PRD's acceptance criterion is written as an absolute. **Recommend amending the PRD** rather than raising a bug. | `FR-AUTH-2` |
| **D-02** | **Medium–High** | A correct password on a **disabled** account returns `Account disabled`, while a wrong password returns `Invalid credentials`. The two responses are distinguishable, so an attacker can confirm both that a username exists *and* that a guessed password is correct, even when the account is disabled. Directly contradicts the "without disclosing which field was wrong" criterion. **Strongest candidate for a bug report.** | `FR-AUTH-3`, `NFR-SEC` |
| **D-03** | Low–Medium | On an **empty** Add-User form, `Confirm Password` reports `Passwords do not match` instead of `Required`. Misleading: nothing has been typed in either field. All five sibling fields correctly report `Required`. | `FR-ADM-1`, `NFR-UX` |
| **D-04** | Low | `POST /api/v2/admin/users` returns **`200`**, not `201 Created`, despite creating a resource. OrangeHRM's own Professional API documents `201` for the equivalent call. | `FR-API-10` |
| **D-05** | Informational / PRD correction | `GET /admin/users/999999` → **`404 Record Not Found`**, whereas the PRD documents `422 Invalid Parameter` with `data.invalidParamKeys` for `GET /pim/employees/999999`. Error semantics differ per resource, so `FR-API-6` / `FR-API-7` cannot be asserted uniformly. Additionally, `error.status` is a **string** in 404/422 bodies but an **integer** in 401 bodies. | `FR-API-6`, `FR-API-7` |
| **D-06** | Low | `PUT /api/v2/admin/users/{id}` rejects the request with `422 invalidParamKeys: ["password"]` unless a `password` key is present — even when `changePassword: false`. `null` is also rejected; only `""` is accepted. A mandatory-but-ignored field is an API design wart and a trap for integrators. | `FR-API-10` |
| **D-07** | Low / for review | Effective password policy is **≥ 7 chars, ≥ 1 digit, ≥ 1 lower-case** — no upper-case, symbol, or complexity requirement. `abcdef1` is accepted. The PRD requires only that "a password failing the policy is rejected with the rule stated", which is met; whether this policy is strong enough is a product decision. | `FR-ADM-2`, `NFR-SEC` |
| **D-08** | Informational / PRD correction | The PRD records `api.orangehrm.com` as yielding "no readable content to a crawler" and treats the Professional/Enterprise API as a **superset** of the OS build. Both are wrong: the portal renders fully in a JS-capable browser, and it explicitly excludes Open Source. The two APIs differ in base path, resource names, verbs, auth model, and field casing (§4.1). **`FR-API-12`, `FR-API-13`, and `FR-API-14` are therefore not testable against the build under test** and should be marked out of scope rather than `[ASSUMPTION]`. | `FR-API-12/13/14` |
| **D-09** | Test-design note | Field validation is debounced; reading an error message immediately after typing returns the **previous** value's message. Reproduced consistently across seven password probes. Automation must wait for the message to settle or tests will be flaky and assert the wrong rule. | `NFR-MNT` |
| **D-10** | Test-design risk | The demo is shared and publicly credentialled. The user list went from 11 → 12 records mid-session (`Surya99` appeared) with no action from this exploration. Any test asserting an absolute record count, a specific user ID, or list ordering will be intermittently wrong. Tests must create and clean up their own fixtures. | `NFR-REL` |

---

## 7. Not exercised

Listed so these are not mistaken for passes.

| Item | Why | Disposition |
|---|---|---|
| `FR-AUTH-8` — idle session timeout | Requires waiting out an unknown configured interval | Remains `[ASSUMPTION]`; needs a long-running or clock-manipulated test |
| `FR-API-9` — ESS cannot read another employee's record | No ESS credentials are published; only the `Admin` account is usable | Blocked. Requires provisioning an ESS user with a known password — feasible via `POST /admin/users` in a dedicated test fixture |
| ESS role-based denial of the Admin module | Same blocker as above | Blocked, same remedy |
| Password-reset email delivery | No mailbox access on the demo | Out of reach; verify the request screen only |
| `FR-ADM-17` — OAuth client registration | Dependent on `D-08`; the OS build exposes no working token endpoint | Recommend out of scope |
| Deleting the `Admin` account | Deliberately **not attempted** — would break the shared public demo for all users | Excluded on purpose |

---

## 8. Recommended next steps

1. **Raise `D-02`** as the priority bug — it is a genuine security finding with a clean, reproducible three-step case (§3.7).
2. **Amend the PRD** for `D-01`, `D-05`, and `D-08`. `D-08` in particular moves the scope boundary: three `FR-API` requirements go from `[ASSUMPTION]` to out of scope.
3. **Promote `FR-API-10` from `[ASSUMPTION]` to verified** — the full `POST` / `PUT` / `DELETE` contract is captured in §3.6.
4. **Add `GET /api/v2/admin/validation/user-name`** to the PRD's §3.13.3 endpoint inventory; it is live and currently undocumented.
5. **Provision an ESS fixture user** so the role-scope requirements in §7 become testable.
6. Carry the locator tables (§1.2, §2.1) into the automation phase, along with the two automation hazards — unnamed icon buttons and debounced validation — into the test design.

---

*Prepared from live exploration on 2026-10-12. All probe data created during this exploration was removed; the user list was returned to its prior state.*
