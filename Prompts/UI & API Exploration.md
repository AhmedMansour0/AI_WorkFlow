Explore the UI and API based on the PRD.

Inputs:
- Project URLs: https://opensource-demo.orangehrmlive.com/ & https://api.orangehrm.com/
- PRD: Refer to the `PRD.md` file in the current directory.
- Coverage Scope: Focus strictly on the "Authentication (Login)" and "Admin (User Management)" modules for both UI and API.

Steps to follow:
1. Read the relevant sections in `PRD.md` to understand the target scope.
2. Use your fetch/Playwright tools to explore the live UI and API specifically for these modules (e.g., capture the actual DOM structure of the login page, and the API payload for authentication or user lists).
3. Document your exploration findings clearly (observed behaviors, specific API request/response JSON structures, UI locators/elements).
4. Strictly format the output in Markdown.
5. Use the filesystem tool to save the output locally in the current directory as a file named `exploration.md`. Do not print the entire file content in the chat, just confirm when it's saved.