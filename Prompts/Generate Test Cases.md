Generate Test Cases CSV.

Inputs:
- `PRD.md` (for requirements and scope)
- `exploration.md` (for technical details, API payloads, and actual behaviors)

Steps to follow:
1. Design comprehensive test cases for the "Authentication" and "Admin (User Management)" modules covering both UI and API levels.
2. Format the output strictly as a CSV.
3. The CSV MUST contain exactly these columns: `Test Case ID, Description, Pre-conditions, Steps, Expected Result, Actual Result, Status, valid in scope, needs automation`.
4. The `valid in scope` column MUST be 'Yes' or 'No'.
5. The `needs automation` column MUST be 'Yes' or 'No' based on whether the test is repeatable and suitable for Playwright UI/API scripts.
6. Make sure to include positive, negative, and boundary test cases.
7. Use the filesystem tool to create and save the file directly as `test_cases.csv` in the current directory. Do not print the entire CSV content in the chat.