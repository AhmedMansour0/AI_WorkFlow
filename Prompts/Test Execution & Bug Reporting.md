Test Execution, Bug Reporting, and HTML Report Generation.

Inputs:
- `test_cases.csv`
- `exploration.md` (Use this as your execution evidence to determine the 'Actual Result' and 'Status' for each test case).
- `resources/QA Execution Report Sample.html` (Use the filesystem tool to read this file first. Analyze its exact HTML structure, CSS variables, and layout).

Steps to follow:
1. Read the `test_cases.csv` file and filter ONLY the test cases where `valid in scope` is 'Yes'.
2. Evaluate the test cases based on the findings and deviations in `exploration.md`. Mark them as 'Pass' or 'Fail', and write the Actual Result.
3. Determine today's date dynamically (format: YYYY-MM-DD).
4. Create the Bug Reports for every 'Fail' status.
   STRICT BUG REPORTING FORMAT: Use strictly English for bug reports. The title must follow exactly this structure: `[EndPoint][Title]`. The body must contain exactly these sections: Description, Steps to reproduce, Expected Result, Actual result.
5. Save the generated Bug Reports into a SEPARATE Markdown file named `Defect_Reports_YYYY-MM-DD.md`.
6. Generate the execution HTML report. Mimic the exact visual design of the `resources/QA Execution Report Sample.html` template (Add Request and Response field for API Test Cases in new button like "View TestCase button")(In Evidence Section Take a Screenshot with red label on the bug area). The HTML report MUST ALSO include a dedicated "Defect Reports" section containing the same Bug Reports in full (same IDs, titles and sections as `Defect_Reports_YYYY-MM-DD.md`), and each failed test case must link to its bug.
7. Set the main heading (`<h1>`) inside the HTML to include the date.
8. Use the filesystem tool to save this HTML file as `Execution_Summary_YYYY-MM-DD.html`.
9. Generate Execution Time Breakdown in a SEPARATE HTML file named `Execution_Time_Breakdown_YYYY-MM-DD.html`. Mimic the exact visual design of the `resources/Execution Time Breakdown Sample.html` template, and link it from the "View Time Breakdown" link in `Execution_Summary_YYYY-MM-DD.html`.
10. Save all outputs of this manual execution (Defect Reports, Execution Summary and Time Breakdown) in `Execution-outputs/Manual`.