---
name: exploration-analyzer
description: "Explore a live UI and REST API against an existing PRD and write exploration.md with resilient locators, captured request/response payloads, error contracts, automation hazards and numbered deviations (D-nn). Always asks the user for the project URLs and the PRD coverage scope before starting. Use when asked to explore, investigate or analyze an application UI or API before test design or automation, or to find defect candidates against requirements."
---

# Skill: Exploration Analyzer

**Version:** 1.1
**Role:** Automation Engineer / Technical QA
**Purpose:** Explore the live UI and API against the generated PRD to document technical implementations, capture locators, and identify early defects.

This skill is **project-agnostic**. It never assumes a target system, URL or module. All inputs are confirmed with the user in Step 0 on **every** invocation.

## 0. Step 0: Ask for the inputs (MANDATORY, every time)
Before opening any URL, reading the live system or writing files, collect these three inputs with the **AskUserQuestion** tool:
1. **Project URLs:** the UI URL, and the API URL or API documentation URL if there is one.
   - Read `PRD.md` first and offer the URLs it references as options. The user can type different URLs through "Other".
   - The UI URL is required. The API URL is optional; offer "No separate API URL" as an option.
2. **PRD file:** default to `PRD.md` in the current directory (or `Project-Documents/PRD.md`). If neither exists, ask for the path.
3. **Coverage scope:** which PRD modules to explore, and whether to cover UI, API or both.
   - Build the options from the PRD's module groups (requirement ID prefixes such as `FR-AUTH-*`, `FR-ADM-*`, or the Functional Requirements headings) with `multiSelect: true`. If there are more than four modules, offer the four largest; the user can type others through "Other".
   - Ask UI / API / both as a separate question.

Rules:
- Ask **even if** the user's request already mentions URLs or modules, or a previous run used them. The answers are the only source of scope. Never reuse an earlier answer silently.
- If the target requires login and no test credentials are documented in the PRD or on the login page, ask for them as well. Never guess credentials.
- Do not continue until the user answers. Repeat the confirmed URLs and scope back in one line before Step 1.

## Steps
1. **Read the PRD for the scope.** Read only the sections of the PRD that cover the selected modules, to understand the target scope and the requirement IDs to verify against.
2. **Explore the live system.** Use the fetch and Playwright tools to explore the live UI and API for the selected modules only, for example the actual DOM structure of the module's key screens and the API payloads behind its main operations. Follow §2 and §3 below. Extract text, locators and network traffic; never read massive raw HTML (CLAUDE.md token-efficiency rule).
3. **Document the findings.** Record observed behaviours, the exact API request/response JSON structures and the UI locators/elements, plus every deviation from the PRD (§4).
4. **Format.** Strictly format the output in Markdown, following §5.
5. **Save, don't print.** Save the output with the filesystem tool as `exploration.md` in the current directory. Do not print the file content in the chat; confirm when it is saved, with the scope covered and the number of deviations found.

**Safety on shared or production-like environments:** only create, change or delete data that the exploration created itself, remove it before finishing, and never delete or disable accounts or records that already existed. Record anything skipped for this reason under "Not Exercised".

## 1. Prerequisites
- Target URLs (UI/API), confirmed in Step 0.
- `PRD.md` (to understand what should be tested).
- Defined Coverage Scope, confirmed in Step 0 (Do not explore out-of-scope modules).

## 2. UI Exploration Best Practices
- **Resilient Locators:** Document the best locators for automation. Prioritize Accessibility-based locators (`getByRole`, `getByLabel`), `name` attributes, and `data-testid`. STRICTLY avoid brittle locators like absolute XPaths or auto-generated dynamic IDs.
- **Automation Hazards:** Explicitly document UI quirks that could break automation (e.g., "Debounced validation fields," "Missing aria-labels on buttons," "Overlapping modals," "Asynchronous loading without spinners").

## 3. API Exploration Best Practices
- **Payload Capture:** Capture exact Request Methods, Headers (e.g., CSRF tokens), Request Bodies, and Status Codes.
- **Error Contracts:** Force negative scenarios (e.g., invalid parameters, missing auth) to document the exact JSON error schema returned by the server.

## 4. Deviation & Defect Identification
- If the observed behavior contradicts the PRD, it must be documented as a "Defect Candidate" or "Deviation".
- Number these findings logically (e.g., `D-01`, `D-02`).
- Format: `Observation | Contradicts Requirement ID | Severity`.

## 5. Output Format
The resulting file must be saved as `exploration.md` and structured as:
1. Executive Summary & Build Info.
2. UI Exploration (Locators, Observed Behaviors vs. Expected).
3. REST API Exploration (Auth mechanisms, Endpoints, Payloads).
4. Deviations and defect candidates.
5. Not Exercised (Features that were blocked or couldn't be reached).
