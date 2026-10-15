---
name: execution-reporter
description: "Execute in-scope test cases against exploration evidence, file bug reports in [EndPoint][Title] format (in the HTML report and in a separate Defect_Reports_YYYY-MM-DD.md), generate Execution_Summary_YYYY-MM-DD.html mimicking resources/QA Execution Report Sample.html (with request/response viewers for API cases and annotated bug screenshots), and produce Execution_Time_Breakdown_YYYY-MM-DD.html mimicking resources/Execution Time Breakdown Sample.html. Always asks the user for the input files, the modules and test levels to execute, and the output location before starting. Use when asked to execute or evaluate test cases, report test results, write bug or defect reports, produce an execution summary report, or break down execution time."
---

# Skill: Execution & Reporter

**Description:**
Standard operating procedure for executing test cases against exploration findings and generating professional, distinct execution artifacts.

This skill is **project-agnostic**. It never assumes which files, modules or levels to execute, or where to write the reports. All inputs are confirmed with the user in Step 0 on **every** invocation.

**0. Step 0: Ask for the inputs (MANDATORY, every time)**
Use the **AskUserQuestion** tool before evaluating any test case:
1. **Input files:** default to `test_cases.csv` and `exploration.md` in the current directory (or in `Project-Documents/`), and to the two templates in `resources/`. Offer the files found as options; if any is missing, ask for its path.
2. **Modules to execute:** build the options from the module codes in the Test Case IDs (`TC-<MODULE>-<TYPE>-###`), each described with its count of `valid in scope` = 'Yes' cases, with `multiSelect: true`. If there are more than four modules, offer the four largest; the user can type others through "Other".
3. **Test levels:** UI, API or both.
4. **Output location:** default to `Execution-outputs/Manual/` (automated Playwright runs use `Execution-outputs/Automation/` through the playwright-automation skill). If reports for today's date already exist there, ask whether to overwrite them, save with a suffix (for example `_run2`), or save into a sub-folder. Never overwrite an earlier report without asking.

Rules:
- Ask **even if** the user's request already names files, modules or levels, or a previous run used them. The answers are the only source of scope. Never reuse an earlier answer silently.
- Do not continue until the user answers. Repeat the confirmed files, modules, levels and output location back in one line before evaluating anything.

**1. Required Inputs** (confirmed in Step 0)
- `test_cases.csv` (or equivalent test design artifact)
- `exploration.md` (serving as execution evidence for the Actual Result and Status of each test case)
- `resources/QA Execution Report Sample.html` (Reference UI template for the execution summary). Read it first with the filesystem tool and analyze its exact HTML structure, CSS variables and layout.
- `resources/Execution Time Breakdown Sample.html` (Reference UI template for the time breakdown). Read it with the filesystem tool and analyze its exact HTML structure, CSS variables and layout.

**2. Execution Logic**
- Determine today's date dynamically (format: `YYYY-MM-DD`) and use it in every output file name and in the report heading.
- Filter the test cases: Evaluate ONLY rows where `valid in scope` = 'Yes' that belong to the modules and test levels selected in Step 0.
- Cross-reference the "Expected Result" against the actual findings, behaviors, and deviations documented in `exploration.md`.
- Determine the Status ('Pass' or 'Fail') and populate the "Actual Result" column accurately based on evidence.
- **Capture timing while executing:** record the start and end timestamp of the run, of each phase, and of each test case, split into execution, waiting, Claude/AI processing and reporting time. Output 3 is built from these timestamps and cannot be reconstructed afterwards.
- **Capture API evidence:** for every API test case, keep the exact request (method, URL, headers with secrets/cookies redacted, body) and the response (status, headers, body) used to decide its status.

**3. Output 1: Defect Reports (Separate File + inside the HTML report)**
- Every bug is written ONCE and published in TWO places with identical content: this separate Markdown file and the "Defect Reports" section of the HTML report (Output 2).
- Generate a standalone markdown file containing ONLY the bugs identified during execution: one bug report for every test case with status 'Fail'. Number them `BUG-01`, `BUG-02`, … so the same ID is used in both places.
- **Storage:** Save locally as `Defect_Reports_YYYY-MM-DD.md`.
- **Language Constraint:** STRICTLY English.
- **Strict Naming Convention:** `[EndPoint][Title]` (e.g., `[/web/index.php/auth/validate][Disabled account check leaks state]`).
- **Required Sections per Bug:**
  - Description
  - Steps to reproduce
  - Expected Result
  - Actual result
  - Traceability ID (Link to the specific `Test Case ID` and `FR/NFR` ID)

**4. Output 2: HTML Execution Summary**
- **Storage:** Save locally as `Execution_Summary_YYYY-MM-DD.html` using the filesystem tool.
- **Template Mimicry:** Parse and exactly mimic the visual design, CSS variables, layout grids, and donut charts from `resources/QA Execution Report Sample.html`.
- **Contents:**
  - Executive Summary (Total Executed, Pass, Fail, Pass Rate). Include the execution date in the `<h1>` title.
  - Execution Details: Collapsible sections for Passed and Failed test cases showing ID, Description, Expected, and Actual results.
  - **API test cases: Request & Response viewer.** Add a second toggle button next to the existing "View Test Case" button (for example "View Request & Response"). It expands a panel showing the captured request (method, URL, headers, body) and response (status, headers, body), styled with the template's request/response blocks. Redact session cookies, tokens and passwords.
  - **Evidence screenshots with a red label on the bug.** For every failed test case, the Evidence section must contain a screenshot of the defect:
    - Take the screenshot with the Playwright MCP at the moment the defect is visible.
    - Before capturing, mark the bug area: draw a red outline around the defective element and attach a short red label stating the defect (for example "BUG-01: Account disabled ≠ Invalid credentials").
    - Embed the image in the HTML as a `data:` URI so the report stays a single self-contained file, and give it `alt` text describing the defect.
    - For API-only defects with no UI, show the failing response in the Request & Response viewer and highlight the offending field in red instead of a screenshot.
  - Link to the time breakdown file (`Execution_Time_Breakdown_YYYY-MM-DD.html`, relative link in the same folder) from the Executive Summary, in the position of the template's "View Time Breakdown" link.
  - **Defect Reports section (MANDATORY, per CLAUDE.md):** a dedicated section containing every bug in full, with the same `BUG-nn` IDs, `[EndPoint][Title]` titles and sections (Description, Steps to reproduce, Expected Result, Actual result, Traceability ID) as `Defect_Reports_YYYY-MM-DD.md`. Style it with the template's defect/finding blocks, give each bug an anchor (`id="BUG-nn"`), link every failed test case card to its bug, and note at the top of the section that the same reports are also saved separately in `Defect_Reports_YYYY-MM-DD.md`.
  - **NO EXECUTED CSV:** NEVER generate or save a separate executed CSV file (e.g., `Test_Cases_Executed_*.csv`). Read `Test_Cases.csv` in-memory only, evaluate the in-scope tests, and output the results exclusively into the HTML execution report (`Execution_Summary_YYYY-MM-DD.html`) and the defect report (`Defect_Reports_YYYY-MM-DD.md`).

**5. Output 3: Execution Time Breakdown (Separate File)**
- **Storage:** Save locally as `Execution_Time_Breakdown_YYYY-MM-DD.html` with the filesystem tool, in the same folder as `Execution_Summary_YYYY-MM-DD.html`.
- **Template Mimicry:** Parse and exactly mimic the visual design, CSS variables, layout, section order, tables and wording of `resources/Execution Time Breakdown Sample.html`, including its interactive behaviour: collapsible numbered sections, the "Expand all" / "Collapse all" buttons, and phase rows that open a "Details ›" breakdown.
- **Self-contained:** one HTML file with inline CSS and JavaScript and no external resources, so it opens offline next to the execution summary.
- **Contents (same order as the sample):**
  - Header: "← Back to QA Execution Report" link to `Execution_Summary_YYYY-MM-DD.html`, the date in the `<h1>`, Total Duration, Execution Start and Execution End (UTC).
  - **1. Time Breakdown:** duration and % for Test Case Execution, Waiting, Claude / AI Processing, Reporting and Other / Overhead, ending with an "Accounted Time = Total Duration ✓" check. The categories must add up to the total.
  - **2. Execution Phases:** table with `Phase | Start | End | Duration | %`, with sub-steps indented under their phase; clicking a phase row opens its details.
  - **3. Claude / AI Operations:** table of AI processing operations with the `Related TC` for each.
  - **4. Test Case Time:** table with `# | Test Case ID | Test Case | Status | Execution | Waiting | Claude | Reporting | Total`.
  - **5. Timeline:** chronological list of the run's main events.
  - **6. Other / Overhead:** for each overhead window, what happened "Right before", "What happened in this window" and "Right after".
