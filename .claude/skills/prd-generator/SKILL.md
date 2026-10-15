---
name: prd-generator
description: "Reverse-engineer a Product Requirements Document (PRD.md) from a live system by scanning its UI and API URLs with token-efficient extraction. Always asks the user for the project name, the target URLs and the PRD scope before starting. Use when asked to generate, write or update a PRD, requirements spec or functional requirements for a web application, including traceable FR/NFR IDs, acceptance criteria, user roles, API configuration and out-of-scope items."
---

# Skill: PRD Generator

**Version:** 1.1
**Role:** Business Analyst / QA Architect
**Purpose:** Reverse-engineer and generate a comprehensive Product Requirements Document (PRD) by intelligently scanning a live system's UI and API URLs.

This skill is **project-agnostic**. It never assumes a product, URL or module. All inputs are confirmed with the user in Step 0 on **every** invocation.

## 0. Step 0: Ask for the inputs (MANDATORY, every time)
Use the **AskUserQuestion** tool. Ask in two rounds:

**Round 1, before touching any URL:**
1. **Project name:** the product the PRD describes (used in the title and overview).
2. **Target URLs:** the UI URL (required), and the API URL or API documentation URL (optional; offer "No API URL" as an option). If URLs appear in existing project files (for example an earlier `PRD.md` or a prompt file), offer them as options; the user can type others through "Other".
3. **Existing PRD:** if a `PRD.md` already exists in the target location, ask whether to overwrite it, update it in place, or save under a new name.

**Round 2, after a quick scan of the main navigation only (§1 rules):**

4. **PRD scope:** the whole product, or specific modules.
   - Build the module options from the main menu just scanned, with `multiSelect: true`. If there are more than four modules, offer the four most prominent; the user can type others through "Other".
   - Also ask whether the PRD should cover the UI, the API or both.

Rules:
- Ask **even if** the user's request already mentions a project, URLs or modules, or a previous run used them. The answers are the only source of scope. Never reuse an earlier answer silently.
- If the system requires login and no demo credentials are visible on the login page, ask for test credentials. Never guess credentials.
- Do not continue past each round until the user answers. Repeat the confirmed project, URLs and scope back in one line before Step 1.

## Steps
1. **Scan.** Use the fetch tool (or the Playwright tools for pages that need JavaScript to render) to quickly scan the confirmed URLs and understand the core functionality of the in-scope modules. Extract text content, main menus and API summaries only, to save tokens (§1).
2. **Generate.** Write a comprehensive PRD from the findings, separating what was observed from what is assumed (§2).
3. **Structure.** Strictly format the PRD according to the "Documentation & Exploration Standards" in CLAUDE.md and §3 below. It MUST include Overview, User Roles, Functional Requirements, Non-Functional Requirements and Out of Scope. Modules outside the confirmed scope are listed under Out of Scope, not described.
4. **Save, don't print.** Save the PRD with the filesystem tool as `PRD.md` in the current directory (or the name chosen in Step 0). Do not print the file content in the chat; confirm when it is saved, with the scope covered and the number of FR and NFR IDs.

## 1. Token-Optimized Extraction Strategy
To prevent context window overflow and reduce API costs, NEVER attempt to read massive raw HTML DOM structures or unminified JSON files directly.
- **UI Scanning:** Use tools (like Puppeteer or Fetch) to extract `innerText`, meta tags, main headings (`<h1>` to `<h3>`), and navigation menus. Ignore styling (CSS), scripts (JS), and deeply nested `<div>` layouts.
- **API Scanning:** Look for Swagger/OpenAPI docs or intercept XHR requests. Extract only Endpoints, HTTP Methods, and summary payloads. Do not read entire response arrays; sample the first object in an array.

## 2. Confidence and Assumptions Handling
Since this is reverse-engineered without a vendor spec:
- **Directly Observed:** Features explicitly interacted with or captured via network traffic.
- **Inferred/Assumptions:** Features that are standard but couldn't be fully exercised (e.g., email routing, payment gateways). These MUST be clearly flagged inline with `[ASSUMPTION]`. Any test case based on an assumption must later be evaluated carefully.

## 3. Mandatory PRD Structure
The generated `PRD.md` MUST strictly follow this layout:

### 3.1 Overview
- Product summary, Business Objectives, and Scope of the document. Include a Glossary if specific terminology is used.

### 3.2 User Roles & Access Matrix
- Define system-level user roles (e.g., Admin, ESS, Unauthenticated).
- Create a Role-to-Module Access Matrix table.

### 3.3 Functional Requirements (FR)
- Group requirements by module (e.g., Authentication, Dashboard, User Management).
- **Traceability MUST be applied:** Every requirement must have a unique, stable ID (e.g., `FR-AUTH-1`, `FR-ADM-2`).
- Include Acceptance Criteria for each FR.

### 3.4 REST API Configuration
- Document Authentication flow (e.g., Session Cookie, OAuth 2.0 Bearer Token).
- Outline the observed Endpoints inventory, Methods, and standard Response Envelopes.

### 3.5 Non-Functional Requirements (NFR)
- Performance, Security, Usability/Accessibility, Reliability. Give these IDs as well (e.g., `NFR-SEC-1`).

### 3.6 Out of Scope
- Explicitly list features or actions that are NOT part of the testing scope to prevent hallucinated test cases.

## 4. Output Constraints
- Always use the filesystem tool to save the output locally as `PRD.md`.
- Do not print the entire markdown file in the chat interface.
