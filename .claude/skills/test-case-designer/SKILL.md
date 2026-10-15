---
name: test-case-designer
description: "Design structured test cases from PRD.md and exploration.md and save them as a CSV with the mandatory headers (Test Case ID, Description, Pre-conditions, Steps, Expected Result, Actual Result, Status, valid in scope, needs automation). Always asks the user for the input files, the modules and the test levels (UI/API) before starting. Use when asked to create, generate or design test cases, a test suite or test scenarios covering positive, negative, boundary and discovered-behaviour cases."
---

# Skill: Test Case Designer

**Version:** 1.1  
**Scope:** Reusable QA Test Case Design Protocol (Cross-project)  
**Author:** QA Engineering

This skill is **project-agnostic**. It never assumes which modules or test levels to cover. All inputs are confirmed with the user in Step 0 on **every** invocation.

---

## 0. Step 0: Ask for the inputs (MANDATORY, every time)
Use the **AskUserQuestion** tool before designing anything:
1. **Input files:** default to `PRD.md` and `exploration.md` in the current directory (or in `Project-Documents/`). Offer the files found as options; if either is missing, ask for its path. If `exploration.md` does not exist, ask whether to continue from the PRD alone; every case that depends on unobserved behaviour is then marked as resting on an assumption.
2. **Modules:** which modules to design test cases for.
   - Build the options from the PRD's module groups (requirement ID prefixes such as `FR-AUTH-*`, `FR-ADM-*`, or the Functional Requirements headings) with `multiSelect: true`. Mark modules that `exploration.md` actually covers. If there are more than four modules, offer the four largest; the user can type others through "Other".
3. **Test levels:** UI, API or both.
4. **Existing CSV:** if `test_cases.csv` already exists, ask whether to overwrite it, append to it, or save a separate `<module>_test_cases.csv`. When appending, continue each module's numbering after the highest existing ID and never reuse or renumber an existing ID (test scripts and bug reports reference them).

Rules:
- Ask **even if** the user's request already names modules or levels, or a previous run used them. The answers are the only source of scope. Never reuse an earlier answer silently.
- Do not continue until the user answers. Repeat the confirmed files, modules and levels back in one line before Step 1.

## Steps
1. **Design.** Design comprehensive test cases for the **selected modules** at the **selected levels**, using the PRD for requirements and scope and `exploration.md` for technical details, API payloads and actual behaviours. Trace each case to its requirement ID (and deviation ID `D-nn` where one exists) in the Description.
2. **Format.** Format the output strictly as a CSV (§3.1).
3. **Columns.** The CSV MUST contain exactly these columns: `Test Case ID, Description, Pre-conditions, Steps, Expected Result, Actual Result, Status, valid in scope, needs automation` (§3.2).
4. **valid in scope.** MUST be 'Yes' or 'No' (§3.3).
5. **needs automation.** MUST be 'Yes' or 'No', based on whether the test is repeatable and suitable for Playwright UI/API scripts (§3.3).
6. **Coverage.** Include positive, negative and boundary test cases, plus discovered behaviours (§4).
7. **Save, don't print.** Save the file with the filesystem tool as `test_cases.csv` in the current directory (or the name chosen in Step 0). Do not print the CSV content in the chat; confirm when it is saved, with the number of cases per module and how many are marked `needs automation = Yes`.

---

## 1. Overview & Purpose
This skill defines the standard procedure for analyzing Product Requirement Documents (PRDs) alongside Technical Exploration findings to construct high-coverage, deterministic test suites formatted as structured CSV artifacts.

---

## 2. Prerequisites & Required Inputs
Before generating test suites, ensure the following context files are present (confirmed in Step 0):
1. `PRD.md` — The product functional, non-functional, and boundary specifications.
2. `exploration.md` — Concrete findings, API payloads, observed responses, DOM locators, and environmental quirks.

---

## 3. CSV File Specifications

### 3.1 File Delivery
- Output format: `.csv` (Comma-Separated Values).
- Default filename: `test_cases.csv` (or `<module>_test_cases.csv` for isolated sub-suites).
- All string fields containing commas, line breaks, or double quotes must be enclosed within standard RFC 4180 double quotation marks (`"..."`).

### 3.2 Mandatory Header Schema
The generated CSV file **must** strictly use the following header row:
```text
Test Case ID,Description,Pre-conditions,Steps,Expected Result,Actual Result,Status,valid in scope,needs automation
```

### 3.3 Column Definitions & Evaluation Matrix

| Column Header | Format / Allowed Values | Evaluation Logic |
|---|---|---|
| **Test Case ID** | `TC-<MODULE>-<TYPE>-###` | E.g., `TC-AUTH-UI-001`, `TC-ADM-API-004`. Use hierarchical, predictable keys. |
| **Description** | Plain text | Concise summary stating target functionality, input scenario, and intent. |
| **Pre-conditions** | Plain text / Bullet-like list | Environment state, user role, test data fixtures, or active sessions needed. |
| **Steps** | Numbered sequence (`1. ... 2. ...`) | Atomic, reproducible end-to-end user actions or HTTP request steps. |
| **Expected Result** | Plain text | Verifiable system reaction (status codes, DOM states, toast messages). |
| **Actual Result** | Empty / String | Empty before execution; populated with observed output during execution phase. |
| **Status** | `Not Run`, `Pass`, `Fail`, `Blocked` | Initial default must always be `Not Run`. |
| **valid in scope** | `Yes` \| `No` | **Strict PRD Cross-Check:**<br>• `Yes`: Requirements clearly confirmed by PRD.<br>• `No`: Out-of-scope modules, unsupported endpoints (e.g. Enterprise vs OS), unverified assumptions. |
| **needs automation** | `Yes` \| `No` | **Automation Feasibility:**<br>• `Yes`: Stable, deterministic, functional UI/API flows suitable for Playwright scripts.<br>• `No`: Edge visual-only checks, CAPTCHA, manual 3rd party actions, or out-of-scope tests. |

---

## 4. Coverage Strategy & Test Classification

Ensure the suite covers all four essential dimensions:
1. **Happy Path / Positive Functional Tests:** Core flows with valid data.
2. **Negative Validation Tests:** Form field omissions, malformed data, schema rejections.
3. **Boundary Value Analysis (BVA):** Minimum/maximum password lengths, limits, and paging boundaries.
4. **Discovered Behaviors & Security Quirks:**
   - Asynchronous/debounced input validation.
   - Distinct error messages revealing account state (e.g., account enumeration/leakage).
   - Server-side API enforcement bypassing UI validation.

---

## 5. Execution Rule within AI Agents
- When generating the test suite, write directly to the local disk using file operations.
- Avoid printing complete multiline CSV files directly in conversation logs to prevent token wastage.
