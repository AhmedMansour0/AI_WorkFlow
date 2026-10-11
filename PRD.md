# Product Requirements Document — OrangeHRM

| Field | Value |
|---|---|
| **Product** | OrangeHRM Open Source (OS) — Human Resource Management System |
| **Version under test** | OrangeHRM OS 5.9 |
| **UI target** | https://opensource-demo.orangehrmlive.com/ |
| **API target** | https://api.orangehrm.com/ (REST API v2) |
| **Document owner** | QA Engineering |
| **Date** | 2026-10-11 |
| **Status** | Baseline — derived from live exploration of the public demo |

### Source and Confidence

This PRD was reverse-engineered from the live demo application, not from a vendor specification. Evidence basis:

- **Directly observed (high confidence):** every module, menu, and submenu listed in §3 was enumerated by navigating the demo as the `Admin` user; the API endpoints, response envelope, query parameters, and error format in §3.13 were captured from the demo's own `/api/v2/*` network traffic.
- **Sourced from public documentation (medium confidence):** the OAuth 2.0 authorization model in §3.13.2. The developer portal at `https://api.orangehrm.com/` is a client-side rendered application that returns no readable content to a crawler, and it documents the **Starter/Advanced** editions, whose API surface is a superset of the Open Source build under test.
- **Inferred (flagged inline as `[ASSUMPTION]`):** behavioural rules that are conventional for the product but were not exercised during exploration.

Items marked `[ASSUMPTION]` must be confirmed against the live build before any test case derived from them is marked `valid in scope`.

---

## 1. Overview

### 1.1 Product Summary

OrangeHRM is a web-based Human Resource Management (HRM) system that centralises the full employee lifecycle — recruitment, onboarding, personnel records, leave, time and attendance, performance, and expense claims — in a single application with role-based access control.

The Open Source edition is a self-hosted PHP backend exposing a REST API v2, consumed by a Vue.js single-page frontend. Every screen in the UI is driven by the same public API surface the system exposes to external integrators, which makes the two targets of this document two views of one system rather than two products.

### 1.2 Business Objectives

| # | Objective |
|---|---|
| BO-1 | Maintain a single authoritative record for every employee, replacing scattered spreadsheets. |
| BO-2 | Let employees self-serve routine HR transactions (leave, timesheets, claims, personal data) without HR intervention. |
| BO-3 | Enforce approval workflows and audit trails for leave, time, performance, and expense. |
| BO-4 | Give management visibility into headcount, absence, utilisation, and recruitment pipeline. |
| BO-5 | Expose an integration-grade REST API so payroll and third-party systems can consume HR data. |

### 1.3 Scope of This Document

In scope: the twelve functional modules reachable from the main navigation of OrangeHRM OS 5.9, plus the authentication and REST API v2 layers that support them.

### 1.4 Glossary

| Term | Meaning |
|---|---|
| **ESS** | Employee Self Service — the non-administrative user role. |
| **PIM** | Personnel Information Management — the employee master-record module. |
| **Entitlement** | A quantity of leave days granted to an employee for a leave type within a leave period. |
| **Leave Period** | The annual cycle against which entitlements and usage are calculated. |
| **Sub Unit** | A node in the organisation's hierarchical structure (department, team). |
| **Work Shift** | A named working-hours pattern assignable to employees. |
| **Tracker** | A performance log against which reviewers record ongoing feedback. |
| **Buzz** | The internal social feed. |
| **empNumber** | The system-generated primary key for an employee; distinct from the user-facing `employeeId`. |

---

## 2. User Roles

OrangeHRM OS ships two system-level user roles. Permissions are further narrowed by whether the record being acted on belongs to the acting user, and by supervisor relationships defined in PIM.

| Role | Description | Access |
|---|---|---|
| **Admin** | HR administrator / system owner. | Full access to all twelve modules, all employee records, all configuration, and user management. |
| **ESS** | Standard employee. | Self-service only: own personal data, own leave, own timesheets and attendance, own claims, own performance reviews, Directory, and Buzz. No access to Admin or Maintenance. |
| **ESS — Supervisor** | An ESS user named as a supervisor on one or more employees' *Report-to* records. | ESS rights plus visibility and approval rights over their direct reports' leave, timesheets, and performance records. `[ASSUMPTION]` — the supervisor relationship is configurable in PIM, but approval routing was not exercised during exploration. |
| **Unauthenticated visitor** | Any user before login. | Login screen and the forgot-password flow only. |

**Demo credentials (publicly published on the login screen):** `Admin` / `admin123`.

### 2.1 Role-to-Module Access Matrix

| Module | Admin | ESS |
|---|---|---|
| Admin | Full | No access |
| PIM | All employees | No access |
| Leave | All employees | Own + direct reports |
| Time | All employees | Own + direct reports |
| Recruitment | Full | No access `[ASSUMPTION]` |
| My Info | Own record | Own record |
| Performance | Full | Own reviews + own trackers |
| Dashboard | Full | Full (own-scoped widgets) |
| Directory | Full | Full |
| Maintenance | Full | No access |
| Claim | All claims | Own claims |
| Buzz | Full | Full |

---

## 3. Functional Requirements

Requirements are grouped by module and carry a stable `FR-<MODULE>-<n>` identifier for traceability from the test case suite.

### 3.1 Authentication & Session (`FR-AUTH`)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-AUTH-1 | The system shall present a login screen at `/web/index.php/auth/login` to all unauthenticated users. | Username field, password field, and Login button are rendered; the page states the product version in the footer. |
| FR-AUTH-2 | The system shall authenticate a user against a valid username and password pair and redirect to `/dashboard/index` on success. | Valid credentials land on the Dashboard with the user's name shown in the header. |
| FR-AUTH-3 | The system shall reject invalid credentials without disclosing which field was wrong. | An "Invalid credentials" message is displayed; the user remains on the login screen. |
| FR-AUTH-4 | The system shall enforce that both username and password are supplied. | Submitting either field empty surfaces a "Required" validation message against that field. |
| FR-AUTH-5 | The system shall provide a self-service password reset entry point ("Forgot your password?"). | The link navigates to the password-reset request screen and accepts a username. |
| FR-AUTH-6 | The system shall deny access to any authenticated route when no valid session exists and redirect to the login screen. | Requesting a module URL directly while logged out returns the login screen. |
| FR-AUTH-7 | The system shall terminate the session on logout and invalidate the back-navigation path to authenticated content. | After logout, browser Back does not restore an authenticated page. |
| FR-AUTH-8 | The system shall expire an idle session. `[ASSUMPTION]` — timeout duration not confirmed. | After the configured idle period, the next request redirects to login. |

### 3.2 Dashboard (`FR-DASH`)

The Dashboard is the post-login landing page and aggregates widgets scoped to the current user.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-DASH-1 | The system shall display a **Time at Work** widget showing current punch state, today's total, and the current week's total with its date range. | Widget renders punch status ("Punched In"/"Punched Out"), last punch timestamp with timezone, today's hours, and the week range. |
| FR-DASH-2 | The system shall display a **My Actions** widget listing items awaiting the current user, each as a navigable shortcut. | Pending items (e.g. "(1) Pending Self Review", "(1) Candidate to Interview") are listed with counts and navigate to the owning record. |
| FR-DASH-3 | The system shall display a **Quick Launch** widget of shortcuts to frequent actions. | Shortcut tiles render and navigate to their target screens. |
| FR-DASH-4 | The system shall display a **Buzz Latest Posts** widget showing the most recent social feed entries. | Each entry shows author, timestamp, and post body. |
| FR-DASH-5 | The system shall display an **Employees on Leave Today** widget. | Employees with approved leave covering the current date are listed; an empty state renders when none. |
| FR-DASH-6 | The system shall display **Employee Distribution by Sub Unit** and **Employee Distribution by Location** charts. | Both charts render with a legend; segments reflect current headcount. |
| FR-DASH-7 | All dashboard widgets shall be driven by the `/api/v2/dashboard/*` endpoints and reflect live data. | Widget content matches the corresponding API response payload. |

### 3.3 Admin Module (`FR-ADM`)

Navigation: **User Management**, **Job**, **Organization**, **Qualifications**, **Nationalities**, **Corporate Branding**, **Configuration**.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-ADM-1 | The system shall allow an Admin to create, search, view, edit, and delete system users (**User Management → Users**). | A user record captures user role, employee name, username, status, and password; the list supports filtering by each of these. |
| FR-ADM-2 | The system shall enforce unique usernames and a password policy on user creation. | A duplicate username is rejected; a password failing the policy is rejected with the rule stated. |
| FR-ADM-3 | The system shall allow an Admin to enable or disable a user account without deleting it. | A disabled user cannot authenticate. |
| FR-ADM-4 | The system shall support CRUD on **Job Titles**, including job description and specification attachments. | Created job titles become selectable in PIM job assignment and Recruitment vacancies. |
| FR-ADM-5 | The system shall support CRUD on **Pay Grades**, including currency assignment and minimum/maximum salary bounds. | A pay grade with currencies is selectable in PIM salary assignment. |
| FR-ADM-6 | The system shall support CRUD on **Employment Status**. | Created statuses are selectable in PIM job records and usable as a PIM list filter. |
| FR-ADM-7 | The system shall support CRUD on **Job Categories**. | Created categories are selectable in PIM job records. |
| FR-ADM-8 | The system shall support CRUD on **Work Shifts**, including shift hours and assigned employees. | A work shift defines start/end time and may carry an employee assignment list. |
| FR-ADM-9 | The system shall allow an Admin to maintain **Organization → General Information** (company name, registration number, tax ID, address, contact details, notes). | Changes persist and are reflected on reload. |
| FR-ADM-10 | The system shall support CRUD on **Organization → Locations**, including country, city, address, zip, phone, and notes, and shall show the headcount per location. | Locations are selectable in PIM job records and drive the Dashboard location chart. |
| FR-ADM-11 | The system shall allow an Admin to maintain a hierarchical **Organization → Structure** of sub units. | Nodes can be added as children of any node, edited, and deleted; the hierarchy drives the Sub Unit chart and PIM filters. |
| FR-ADM-12 | The system shall support CRUD on **Qualifications** — Skills, Education, Licenses, Languages, Memberships. | Each qualification type maintains its own list, selectable in the employee's Qualifications tab. |
| FR-ADM-13 | The system shall support CRUD on **Nationalities**. | Created nationalities are selectable in employee Personal Details. |
| FR-ADM-14 | The system shall allow an Admin to configure **Corporate Branding** — client logo, login banner, login page background, and theme colours. | Uploaded assets and colours are applied across the application. |
| FR-ADM-15 | The system shall expose **Configuration** for Email Configuration, Email Subscriptions, Localization, Language Packages, Modules, Social Media Authentication, and Register OAuth Client. | Each configuration screen loads, persists its settings, and validates its required fields. |
| FR-ADM-16 | The system shall allow an Admin to enable or disable optional modules under **Configuration → Modules**. | Disabling a module removes it from the main navigation for all users. |
| FR-ADM-17 | The system shall allow an Admin to register an OAuth client (ID and secret) for REST API access under **Configuration → Register OAuth Client**. | A registered client can obtain an access token per §3.13.2. |

### 3.4 PIM Module (`FR-PIM`)

Navigation: **Configuration**, **Employee List**, **Add Employee**, **Reports**.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-PIM-1 | The system shall allow an Admin to add an employee capturing first, middle, and last name, employee ID, and optional profile photo, and shall optionally create a login account in the same flow. | On save, the employee record is created and the system navigates to the new employee's Personal Details. |
| FR-PIM-2 | The system shall auto-populate a unique employee ID on the Add Employee form while allowing it to be overridden. | A duplicate employee ID is rejected with a validation message. |
| FR-PIM-3 | The system shall present an **Employee List** supporting filters on employee name, employee ID, employment status, "Include" (current/past), supervisor name, job title, and sub unit. | Applying any filter or combination narrows the result set; Reset restores the unfiltered list. |
| FR-PIM-4 | The Employee List shall display ID, first and last name, job title, employment status, sub unit, and supervisor per row, and support paginated navigation with a total record count. | The row count and total match the `/api/v2/pim/employees` response `meta.total`. |
| FR-PIM-5 | The system shall allow bulk and single deletion of employee records with a confirmation step. | Deletion requires explicit confirmation and removes the record from the list. |
| FR-PIM-6 | The system shall maintain the following tabs per employee record: **Personal Details, Contact Details, Emergency Contacts, Dependents, Immigration, Job, Salary, Report-to, Qualifications, Memberships**. | Each tab loads, saves, and reloads its data independently. |
| FR-PIM-7 | **Personal Details** shall capture name, employee ID, other ID, driver's licence number and expiry, nationality, marital status, date of birth, and gender, plus custom fields and attachments. | Mandatory fields are enforced; date fields reject malformed input. |
| FR-PIM-8 | **Contact Details** shall capture street, city, state, zip, country, home/mobile/work telephone, and work and other email. | Email fields reject malformed addresses. |
| FR-PIM-9 | **Emergency Contacts** and **Dependents** shall each support add, edit, and delete of multiple records per employee. | Multiple records persist and list correctly. |
| FR-PIM-10 | **Immigration** shall support add, edit, and delete of documents with number, issued and expiry dates, eligible status, issuing country, and review date. | Expiry date must not precede issue date. `[ASSUMPTION]` |
| FR-PIM-11 | **Job** shall capture joined date, job title, job category, sub unit, location, employment status, and shall support recording termination with a reason and date. | Terminating an employee marks the record as a past employee and excludes it from the default Employee List. |
| FR-PIM-12 | **Salary** shall support adding salary components with pay grade, pay frequency, currency, amount, comments, and direct deposit details. | Amount must be numeric; the salary row persists and is editable. |
| FR-PIM-13 | **Report-to** shall support assigning supervisors and subordinates with a reporting method. | An assigned supervisor appears on the subordinate's record and in the Employee List supervisor filter. |
| FR-PIM-14 | **Qualifications** shall support work experience, education, skills, languages, licences, and memberships per employee. | Each sub-list supports add, edit, and delete. |
| FR-PIM-15 | **PIM → Configuration** shall expose Optional Fields, Custom Fields, Data Import, Reporting Methods, and Termination Reasons. | Each screen loads and persists its settings. |
| FR-PIM-16 | **Custom Fields** shall allow definition of additional employee attributes assigned to a screen, which then render on that screen. | A defined custom field appears on its target tab and its value persists. |
| FR-PIM-17 | **Data Import** shall accept a CSV of employee records and report the outcome of the import. | A well-formed CSV creates the employees; a malformed CSV is rejected with an error. |
| FR-PIM-18 | **PIM → Reports** shall allow definition, execution, editing, and deletion of employee reports with selection criteria and display field groups. | A saved report runs and returns rows matching its criteria. |

### 3.5 Leave Module (`FR-LV`)

Navigation: **Apply**, **My Leave**, **Entitlements** (Add Entitlements, Employee Entitlements, My Entitlements), **Reports** (Leave Entitlements and Usage Report, My Leave Entitlements and Usage Report), **Configure**, **Leave List**, **Assign Leave**.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-LV-1 | The system shall allow a user to **Apply** for leave by selecting a leave type, date range, duration, and optional comment. | The balance for the selected type is displayed before submission; on submit the request enters Pending Approval. |
| FR-LV-2 | The system shall prevent a leave application that exceeds the employee's available entitlement for that type and period. | The request is rejected with a balance-exceeded message. `[ASSUMPTION]` |
| FR-LV-3 | The system shall prevent overlapping leave requests for the same employee and dates. | An overlapping request is rejected. `[ASSUMPTION]` |
| FR-LV-4 | The system shall exclude non-working days and configured holidays from the leave day count. | A request spanning a weekend or holiday deducts only working days. |
| FR-LV-5 | **My Leave** shall list the current user's requests with filters on date range, status, leave type, and "Include Past Employees". | Filters narrow the list; each row shows date, type, balance, number of days, status, and comments. |
| FR-LV-6 | **Leave List** shall let an Admin or supervisor view all (or their reports') leave requests with the same filter set. | The list returns records from `/api/v2/leave/employees/leave-requests`. |
| FR-LV-7 | The system shall allow an authorised approver to Approve or Reject a pending request, and the requester to Cancel it. | The status transitions accordingly and the entitlement balance is adjusted on approval. |
| FR-LV-8 | **Assign Leave** shall let an Admin assign leave directly to an employee, bypassing the application step. | The assigned leave is created in Scheduled/Taken status without requiring approval. |
| FR-LV-9 | **Add Entitlements** shall let an Admin grant an entitlement to an individual employee or in bulk to a location/sub unit, for a leave type and leave period. | The entitlement appears under Employee Entitlements and raises the employee's available balance. |
| FR-LV-10 | **Employee Entitlements** and **My Entitlements** shall list entitlements filtered by employee, leave type, and leave period. | Values match those granted. |
| FR-LV-11 | **Configure → Leave Period** shall define the annual leave cycle start month and day. | Entitlements and reports are calculated against the configured period. |
| FR-LV-12 | **Configure → Leave Types** shall support CRUD on leave types. | A created leave type is selectable on Apply, Assign Leave, and Add Entitlements. |
| FR-LV-13 | **Configure → Work Week** shall define each weekday as full day, half day, or non-working day. | Non-working days are excluded from leave day calculations. |
| FR-LV-14 | **Configure → Holidays** shall support CRUD on holidays with name, date, repeats-annually flag, and full/half day length. | Holidays are excluded from leave day calculations. |
| FR-LV-15 | **Leave Entitlements and Usage Report** shall report entitlements, used, scheduled, pending approval, and available days, generated for a leave type or for an employee. | Totals reconcile against the employee's entitlement and request history. |

### 3.6 Time Module (`FR-TIME`)

Navigation: **Timesheets** (My Timesheets, Employee Timesheets), **Attendance** (My Records, Punch In/Out, Employee Records, Configuration), **Reports** (Project Reports, Employee Reports, Attendance Summary), **Project Info** (Customers, Projects).

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-TIME-1 | **My Timesheets** shall present the current user's weekly timesheet, allowing entry of hours against a project and activity per day. | Hours save per cell; the weekly total recalculates automatically. |
| FR-TIME-2 | The system shall allow a timesheet to be submitted for approval and shall track its state (Not Submitted, Submitted, Approved, Rejected). | Submission locks the timesheet from further edits pending the approval decision. `[ASSUMPTION]` |
| FR-TIME-3 | **Employee Timesheets** shall let an Admin or supervisor retrieve any employee's timesheet by name and period and approve or reject it. | The timesheet loads via `/api/v2/time/employees/timesheets/list` and the decision updates its state. |
| FR-TIME-4 | **Punch In/Out** shall record attendance events with date, time, and an optional note. | A punch-in records a start event; the subsequent punch-out closes it and computes duration. |
| FR-TIME-5 | The system shall prevent a second consecutive punch-in without an intervening punch-out. | The action is blocked with a message. `[ASSUMPTION]` |
| FR-TIME-6 | **My Records** shall list the current user's attendance records for a selected date with punch-in, punch-out, and duration. | Totals match the recorded punches. |
| FR-TIME-7 | **Employee Records** shall let an Admin view, edit, add, and delete any employee's attendance records for a date. | Changes persist and are reflected in Attendance Summary. |
| FR-TIME-8 | **Attendance → Configuration** shall control whether employees may edit their own attendance records and whether supervisors may edit their reports' records. | Toggling a setting changes the corresponding user's ability to edit. |
| FR-TIME-9 | **Project Info → Customers** shall support CRUD on customers with name and description. | A customer is selectable when creating a project. |
| FR-TIME-10 | **Project Info → Projects** shall support CRUD on projects, each linked to a customer and carrying project admins and activities. | Project activities are selectable in timesheet entry. |
| FR-TIME-11 | **Project Reports** shall report hours by project, filtered by project, activity, date range, and "only include approved timesheets". | Reported hours reconcile with submitted timesheet entries. |
| FR-TIME-12 | **Employee Reports** shall report hours by employee for a date range. | Totals reconcile with that employee's timesheets. |
| FR-TIME-13 | **Attendance Summary** shall report total attendance duration per employee, filtered by employee, job title, sub unit, employment status, and date range. | Durations reconcile with attendance records. |

### 3.7 Recruitment Module (`FR-REC`)

Navigation: **Candidates**, **Vacancies**.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-REC-1 | The system shall support CRUD on **Vacancies**, each with job title, vacancy name, hiring manager, number of positions, description, and an active/published state. | A created vacancy is selectable when adding a candidate. |
| FR-REC-2 | The **Vacancies** list shall support filtering by job title, vacancy, hiring manager, and status. | Filters narrow the result set, served by `/api/v2/recruitment/vacancies`. |
| FR-REC-3 | The system shall support adding a **Candidate** with first/middle/last name, email, contact number, vacancy, résumé attachment, keywords, date of application, notes, and a consent-to-keep-data flag. | Email format is validated; the résumé upload accepts the permitted file types and size. |
| FR-REC-4 | The **Candidates** list shall support filtering by job title, vacancy, hiring manager, status, candidate name, keywords, date range, and method of application. | Filters are served by `/api/v2/recruitment/candidates`. |
| FR-REC-5 | The system shall move a candidate through the hiring pipeline, with the available actions determined by the candidate's current status. | Statuses follow the sequence Application Initiated → Shortlisted → Interview Scheduled → Interview Passed/Failed → Job Offered → Offer Declined / Hired, with Reject available throughout. |
| FR-REC-6 | The system shall allow scheduling an interview for a candidate, capturing interview title, interviewer, date, and time. | The scheduled interview is recorded against the candidate and surfaces in the Dashboard "My Actions" widget for the interviewer. |
| FR-REC-7 | The system shall record a hired candidate as an employee record. | On "Hire", a corresponding PIM employee record is created. `[ASSUMPTION]` |
| FR-REC-8 | The system shall maintain a per-candidate history of status transitions with the acting user and timestamp. | The candidate detail screen lists the transition history. |

### 3.8 My Info Module (`FR-MYINFO`)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-MYINFO-1 | The system shall present the current user's own employee record under **My Info** with the same tab set as PIM: Personal Details, Contact Details, Emergency Contacts, Dependents, Immigration, Job, Salary, Report-to, Qualifications, Memberships. | All ten tabs render for the logged-in user's own record. |
| FR-MYINFO-2 | The system shall allow an ESS user to view and edit their own permitted personal data. | Edits persist; fields designated read-only (such as Job and Salary) are not editable by ESS. `[ASSUMPTION]` |
| FR-MYINFO-3 | The system shall support uploading, downloading, and deleting attachments against each tab. | An uploaded attachment is listed with its filename, type, size, and date. |
| FR-MYINFO-4 | The system shall render configured custom fields within My Info. | Custom fields defined in PIM → Configuration appear on their assigned screen. |

### 3.9 Performance Module (`FR-PERF`)

Navigation: **Configure** (KPIs, Trackers), **Manage Reviews** (Manage Reviews, My Reviews, Employee Reviews), **My Trackers**, **Employee Trackers**.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-PERF-1 | **Configure → KPIs** shall support CRUD on key performance indicators, each tied to a job title with minimum and maximum rating bounds. | A KPI is selectable when a review is created for that job title. |
| FR-PERF-2 | **Configure → Trackers** shall support CRUD on performance trackers, each assigned to an employee with one or more reviewers. | The tracker appears under the employee's and the reviewer's tracker lists. |
| FR-PERF-3 | **Manage Reviews** shall let an Admin add a performance review specifying employee, supervisor reviewer, review period, and due date. | The review is created in Scheduled state and appears in the employee's My Reviews. |
| FR-PERF-4 | **My Reviews** shall list the current user's own reviews and allow completion of the self-evaluation. | A pending self-review is surfaced on the Dashboard and can be completed and submitted. |
| FR-PERF-5 | **Employee Reviews** shall let a reviewer list and evaluate the reviews assigned to them, rating each KPI and recording comments. | Ratings are constrained to the KPI's min/max bounds; the review state advances on submission. |
| FR-PERF-6 | **My Trackers** and **Employee Trackers** shall allow adding dated log entries against a tracker. | Log entries persist with author and timestamp and are listed newest first. |
| FR-PERF-7 | Review lists shall support filtering by employee, job title, status, reviewer, and review period. | Filters are served by `/api/v2/performance/employees/reviews`. |

### 3.10 Directory, Maintenance, Claim, and Buzz (`FR-DIR`, `FR-MNT`, `FR-CLM`, `FR-BUZZ`)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-DIR-1 | **Directory** shall present a searchable card view of employees filtered by employee name, job title, and location. | Results are served by `/api/v2/directory/employees`; each card shows name, job title, and location. |
| FR-MNT-1 | **Maintenance** shall require re-entry of the current user's password before granting access ("Administrator Access"). | An incorrect password denies entry to the module. |
| FR-MNT-2 | **Maintenance → Purge Records** shall permanently delete a terminated employee's personal data after confirmation. | The purge removes the record irreversibly and reports the outcome. |
| FR-MNT-3 | **Maintenance → Access Records** shall produce a download of an employee's stored personal data. | The export is generated for the selected employee. |
| FR-CLM-1 | **Submit Claim** shall let a user raise an expense claim selecting an event and currency, then attach expenses and supporting documents. | The claim is created in Initiated state with a reference number. |
| FR-CLM-2 | **My Claims** shall list the current user's claims with filters on reference ID, event, status, and date range. | Each row shows reference, event, description, currency, amount, and status. |
| FR-CLM-3 | **Employee Claims** shall let an Admin list and action all employees' claims. | Served by `/api/v2/claim/employees/requests`; the Admin can approve, reject, or cancel. |
| FR-CLM-4 | **Assign Claim** shall let an Admin raise a claim on behalf of an employee. | The claim is created against the selected employee. |
| FR-CLM-5 | **Claim → Configuration** shall support CRUD on Events and Expense Types. | Created events and expense types are selectable on claim submission, served by `/api/v2/claim/events`. |
| FR-BUZZ-1 | **Buzz** shall present a feed of posts with author, timestamp, and body, newest first. | Served by `/api/v2/buzz/feed` with pagination on scroll. |
| FR-BUZZ-2 | The system shall allow a user to create a text post and to attach photos or embed a video link. | The new post appears at the top of the feed and in the Dashboard Buzz widget. |
| FR-BUZZ-3 | The system shall allow users to like, comment on, and share posts. | Like and comment counts update; comments are listed under the post. |
| FR-BUZZ-4 | The system shall allow a post's author to edit or delete their own post. | Edit and delete are offered only on the author's own posts. |

### 3.11 Global UI Behaviour (`FR-UI`)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-UI-1 | The system shall present a persistent left side panel listing every module the current user may access, and a top bar carrying the module's submenus. | Navigation reflects the user's role; modules disabled in Admin → Configuration → Modules are absent. |
| FR-UI-2 | The side panel shall provide a module search that filters the navigation list as the user types. | Typing narrows the visible module list. |
| FR-UI-3 | The side panel shall be collapsible, and the layout shall remain usable at tablet and mobile widths. | Collapsing widens the content area; no horizontal scroll at supported breakpoints. |
| FR-UI-4 | All list screens shall support pagination and display the total record count. | The count matches the API `meta.total`. |
| FR-UI-5 | All create and edit forms shall validate required fields, data types, and field lengths before submission, displaying the error inline against the offending field. | Invalid input blocks submission and is reported in context. |
| FR-UI-6 | The system shall confirm every destructive action before executing it. | A confirmation dialog is shown; cancelling leaves the record intact. |
| FR-UI-7 | The system shall display a transient success or failure toast after every create, update, and delete. | The toast states the outcome and dismisses automatically. |
| FR-UI-8 | The user menu shall provide About, Support, Change Password, and Logout. | Each option opens its target; Change Password enforces the password policy. |
| FR-UI-9 | Date fields shall use a date picker and shall enforce the configured display format. | Manually typed dates in the wrong format are rejected. |
| FR-UI-10 | Autocomplete fields (employee name, supervisor, hiring manager) shall query as the user types and require selection of a valid record. | Free text that matches no record is rejected with "Invalid". |

### 3.12 Reporting (`FR-RPT`)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-RPT-1 | The system shall provide report definition in PIM, Leave, and Time, each with selection criteria and display fields. | A saved report definition is re-runnable and editable. |
| FR-RPT-2 | Report output shall be paginated and shall reflect the data at the time of execution. | Re-running after a data change reflects the change. |
| FR-RPT-3 | The system shall record the total row count on every report. | The count matches the number of rows returned across all pages. |

### 3.13 REST API v2 (`FR-API`)

The UI is a client of this API; every requirement below was verified against live traffic from the demo instance unless marked otherwise.

#### 3.13.1 Structure and Conventions

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-API-1 | The system shall expose a versioned REST API under `/web/index.php/api/v2/{module}/{resource}[/{id}]`. | All observed endpoints conform to this pattern. |
| FR-API-2 | The system shall expose public, unauthenticated endpoints under `/api/v2/{module}/public/{resource}`. | Public endpoints respond without credentials. |
| FR-API-3 | Successful responses shall use the envelope `{ "data": …, "meta": { … }, "rels": [ … ] }`. | Verified on `GET /api/v2/pim/employees` → keys `data`, `meta`, `rels`. |
| FR-API-4 | List endpoints shall return the unfiltered total in `meta.total`. | `GET /api/v2/pim/employees?limit=2` returns 2 records with `meta.total = 117`. |
| FR-API-5 | List endpoints shall accept `limit`, `offset`, `sortField`, `sortOrder`, and `model` query parameters. | `?limit=2&offset=0&model=detailed&sortField=employee.firstName&sortOrder=ASC` returns 200 with the requested page size and ordering. |
| FR-API-6 | Error responses shall use the envelope `{ "error": { "status": …, "message": …, "data": { … } } }`. | `GET /api/v2/pim/employees/999999` returns HTTP 422 with `message: "Invalid Parameter"` and `data.invalidParamKeys: ["empNumber"]`. |
| FR-API-7 | The API shall validate path and query parameters and reject invalid values with HTTP 422 naming the offending keys. | Verified as above. |
| FR-API-8 | The API shall reject unauthenticated requests to protected resources. | A request without a valid session or bearer token is refused. |
| FR-API-9 | The API shall enforce the caller's role and scope, so that an ESS token cannot read another employee's record. | A cross-employee read with ESS credentials is refused. `[ASSUMPTION]` |
| FR-API-10 | Resource mutations shall use the conventional methods — `POST` create, `PUT` update, `DELETE` remove. | `[ASSUMPTION]` — only `GET` traffic was observed during exploration. |

#### 3.13.2 Authentication

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-API-11 | The web client shall authenticate API calls with the session cookie established at login. | Observed: in-browser `fetch` with `credentials: 'include'` returns 200. |
| FR-API-12 | External integrations shall authenticate via OAuth 2.0, using a client registered at **Admin → Configuration → Register OAuth Client**. | A registered client ID and secret can obtain a token. |
| FR-API-13 | The system shall issue a bearer access token with a bounded lifetime, presented thereafter as `Authorization: Bearer <token>`. | A valid token grants access; an expired or malformed token is refused. |
| FR-API-14 | OrangeHRM Starter/Advanced shall support the Authorization Code with PKCE flow for external API authorization. | Per vendor documentation; not verifiable on the Open Source demo. `[ASSUMPTION]` |

#### 3.13.3 Verified Endpoint Inventory

Captured from live demo traffic. This is the observed subset, not the complete API surface.

| Module | Endpoints |
|---|---|
| **Admin** | `GET /api/v2/admin/users`, `/admin/job-titles`, `/admin/employment-statuses`, `/admin/subunits`, `/admin/organization` |
| **PIM** | `GET /api/v2/pim/employees`, `/pim/employees/{empNumber}`, `/pim/employees/{empNumber}/personal-details`, `/pim/employees/{empNumber}/custom-fields`, `/pim/employees/{empNumber}/screen/personal/attachments` |
| **Leave** | `GET /api/v2/leave/employees/leave-requests`, `/leave/leave-types`, `/leave/leave-periods`, `/leave/holidays`, `/leave/workweek` |
| **Time & Attendance** | `GET /api/v2/time/employees/timesheets/list`, `/attendance/records` |
| **Recruitment** | `GET /api/v2/recruitment/candidates`, `/recruitment/candidates/statuses`, `/recruitment/vacancies`, `/recruitment/hiring-managers` |
| **Performance** | `GET /api/v2/performance/employees/reviews` |
| **Claim** | `GET /api/v2/claim/employees/requests`, `/claim/events` |
| **Buzz** | `GET /api/v2/buzz/feed` |
| **Directory** | `GET /api/v2/directory/employees` |
| **Dashboard** | `GET /api/v2/dashboard/employees/time-at-work`, `/dashboard/employees/action-summary`, `/dashboard/employees/leaves`, `/dashboard/employees/locations`, `/dashboard/employees/subunit`, `/dashboard/shortcuts` |

---

## 4. Non-Functional Requirements

### 4.1 Performance (`NFR-PERF`)

| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-1 | Authenticated page navigation shall complete within an acceptable interactive time. | Dashboard and list screens interactive within 3 s on a broadband connection. |
| NFR-PERF-2 | List API endpoints shall respond within a bounded time at the default page size. | p95 under 1 s for `limit=50`. |
| NFR-PERF-3 | List endpoints shall be paginated so response size does not grow with the dataset. | `limit`/`offset` honoured on every list endpoint. |
| NFR-PERF-4 | The system shall support concurrent use by the organisation's full workforce without degradation. | Target concurrency to be set per deployment. `[ASSUMPTION]` |

### 4.2 Security (`NFR-SEC`)

| ID | Requirement |
|---|---|
| NFR-SEC-1 | All traffic shall be served over HTTPS; the demo enforces this on the public host. |
| NFR-SEC-2 | Passwords shall be stored using a one-way salted hash, never in reversible form. |
| NFR-SEC-3 | Authorisation shall be enforced server-side on every request; hiding a UI control is not sufficient. A direct URL or API call to an out-of-scope record must be refused. |
| NFR-SEC-4 | The application shall be free of injection flaws (SQL injection, XSS) across all user input, including free-text fields in Buzz, PIM notes, and claim descriptions. |
| NFR-SEC-5 | State-changing requests shall carry CSRF protection. |
| NFR-SEC-6 | Session identifiers shall be regenerated on login and invalidated on logout. |
| NFR-SEC-7 | File uploads (résumés, attachments, branding assets) shall be restricted by file type and size and shall not be executable when served back. |
| NFR-SEC-8 | API access tokens shall expire and shall be transmitted only in the `Authorization` header, never in a query string. |
| NFR-SEC-9 | Error responses shall not disclose stack traces, SQL, or internal paths. |
| NFR-SEC-10 | Personal data shall be purgeable on request via Maintenance → Purge Records, in support of data-protection obligations. |

### 4.3 Usability & Accessibility (`NFR-UX`)

| ID | Requirement |
|---|---|
| NFR-UX-1 | Navigation structure shall be consistent across modules: side panel for modules, top bar for submenus, breadcrumb for context. |
| NFR-UX-2 | Every interactive control shall carry an accessible name, so it is reachable by assistive technology and by role-based test locators. |
| NFR-UX-3 | The application shall be operable by keyboard alone for all primary flows. |
| NFR-UX-4 | Validation messages shall be specific and rendered adjacent to the offending field. |
| NFR-UX-5 | The interface shall be localisable, with language packages and date/number formats configurable under Admin → Configuration → Localization. |
| NFR-UX-6 | The layout shall remain usable from 1920 px down to 360 px width without horizontal scrolling of the page body. |

### 4.4 Compatibility (`NFR-CMP`)

| ID | Requirement |
|---|---|
| NFR-CMP-1 | The application shall function on current versions of Chrome, Firefox, Edge, and Safari. |
| NFR-CMP-2 | The application shall function on current iOS and Android mobile browsers. |
| NFR-CMP-3 | The REST API shall be consumable by any standards-compliant HTTP client independently of the web UI. |

### 4.5 Reliability & Data Integrity (`NFR-REL`)

| ID | Requirement |
|---|---|
| NFR-REL-1 | Referential integrity shall be preserved: deleting a referenced master record (job title, leave type, project) shall either be blocked or cascade predictably, never orphan data. |
| NFR-REL-2 | Leave balances shall remain internally consistent across entitlement grants, applications, approvals, cancellations, and rejections. |
| NFR-REL-3 | Concurrent edits to the same record shall not silently overwrite one another. `[ASSUMPTION]` |
| NFR-REL-4 | Timestamps shall be stored and displayed consistently with the configured timezone. |
| NFR-REL-5 | Workflow state transitions (leave, timesheet, claim, candidate) shall be legal-only: no transition outside the defined state machine shall be accepted, including by direct API call. |

### 4.6 Maintainability & Testability (`NFR-MNT`)

| ID | Requirement |
|---|---|
| NFR-MNT-1 | Interactive elements shall expose stable, semantic handles (ARIA role plus accessible name, or a `data-testid`) so UI automation does not depend on CSS structure. |
| NFR-MNT-2 | The API shall remain backward compatible within major version 2. |
| NFR-MNT-3 | A test data set shall be available that can be provisioned and torn down per test run, so tests remain independent and parallel-safe. |
| NFR-MNT-4 | Optional modules shall be independently enableable so the system degrades predictably when a module is off. |

---

## 5. Out of Scope

The following are explicitly **not** requirements of this product as defined by this document. Test cases derived against any item below must be marked `valid in scope = No`.

### 5.1 Functionality Not Present in OrangeHRM Open Source

| # | Item | Note |
|---|---|---|
| OOS-1 | **Payroll processing** — salary calculation, payslip generation, tax computation, statutory filing. | PIM stores salary components as reference data only; no payroll engine exists. |
| OOS-2 | **Benefits administration** — health plans, pension, insurance enrolment. | Not a module in the Open Source edition. |
| OOS-3 | **Learning Management / Training** — course catalogues, enrolment, certification tracking. | Advanced-edition feature. |
| OOS-4 | **Onboarding/Offboarding workflow automation** — task checklists and sequenced approvals. | Advanced-edition feature. |
| OOS-5 | **Succession planning, org-chart visualisation, compensation planning.** | Advanced-edition features. |
| OOS-6 | **Mobile native applications (iOS/Android).** | Only the responsive web UI is in scope. |
| OOS-7 | **Biometric and hardware time-clock integration.** | Attendance is captured through the web Punch In/Out only. |
| OOS-8 | **Multi-company / multi-tenant operation within one instance.** | A single organisation per instance. |

### 5.2 Excluded from Testing

| # | Item | Rationale |
|---|---|---|
| OOS-9 | **Installation, upgrade, and migration procedures.** | The target is a hosted demo instance; no installer is exercised. |
| OOS-10 | **Database schema, server configuration, and infrastructure tuning.** | Below the application boundary. |
| OOS-11 | **Third-party authentication providers (LDAP, SAML, social login).** | Configuration screens exist, but no provider is connected on the demo instance; behaviour cannot be verified. |
| OOS-12 | **Outbound email delivery.** | Email Configuration exists but the demo instance has no deliverable mail route; notification content cannot be asserted end to end. |
| OOS-13 | **Load, stress, and endurance testing against the public demo.** | The demo is a shared public environment; generating load against it is not authorised. Performance targets in §4.1 apply to a dedicated test environment only. |
| OOS-14 | **Penetration testing against the public demo.** | Requires explicit authorisation on an environment the testing party controls. The security requirements in §4.2 are stated for review on an authorised environment. |
| OOS-15 | **Persistence of demo data across sessions.** | The public demo resets periodically; tests must create their own data and must not depend on pre-existing records. |
| OOS-16 | **The `Upgrade` call-to-action and all orangehrm.com marketing pages linked from the product.** | External marketing surface, not product functionality. |
| OOS-17 | **Advanced/Starter-edition API endpoints not present in the Open Source build.** | `https://api.orangehrm.com/` documents a superset; only endpoints resolvable on the target instance are in scope. |

---

## 6. Open Questions

| # | Question | Blocks |
|---|---|---|
| OQ-1 | What is the exact configured session idle timeout? | FR-AUTH-8 |
| OQ-2 | What is the enforced password policy (length, character classes, history)? | FR-ADM-2, FR-UI-8 |
| OQ-3 | Does the system block leave applications exceeding entitlement, or permit a negative balance? | FR-LV-2 |
| OQ-4 | Which PIM fields are editable by an ESS user on their own record? | FR-MYINFO-2 |
| OQ-5 | Does hiring a candidate auto-create the PIM employee record, or is it a manual follow-up? | FR-REC-7 |
| OQ-6 | What are the permitted file types and maximum size for résumé and attachment uploads? | FR-REC-3, FR-MYINFO-3, NFR-SEC-7 |
| OQ-7 | Which write methods (`POST`/`PUT`/`DELETE`) does API v2 expose per resource, and what are their payload schemas? | FR-API-10 |
| OQ-8 | Can an ESS-scoped token read another employee's record through the API? | FR-API-9, NFR-SEC-3 |
| OQ-9 | What is the approval routing for timesheets — supervisor only, or Admin as well? | FR-TIME-2, FR-TIME-3 |

---

## 7. Traceability

Every requirement carries a stable ID. Test cases generated from this document must reference the governing `FR-` or `NFR-` ID, and the `valid in scope` column must be evaluated strictly against the presence of that ID here. A test exercising behaviour listed in §5 is out of scope by definition; a test exercising behaviour marked `[ASSUMPTION]` is blocked on the corresponding open question in §6 and must not be marked in scope until that question is resolved.
