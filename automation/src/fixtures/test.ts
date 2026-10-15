import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { AdminUsersApi } from '../api/AdminUsersApi';
import { EmployeesApi, type Employee } from '../api/EmployeesApi';
import { AppShell } from '../components/AppShell';
import { ADMIN_STATE, ENV } from '../config/env';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { SystemUsersPage } from '../pages/SystemUsersPage';
import { UserFormPage } from '../pages/UserFormPage';
import { UserFactory } from './UserFactory';
import { BugEvidence } from '../utils/evidence';

export interface FreshSession {
  context: BrowserContext;
  page: Page;
  loginPage: LoginPage;
  shell: AppShell;
}

type Fixtures = {
  // Page objects bound to the test's default page
  loginPage: LoginPage;
  forgotPasswordPage: ForgotPasswordPage;
  systemUsersPage: SystemUsersPage;
  userFormPage: UserFormPage;
  appShell: AppShell;

  // API clients
  adminRequest: APIRequestContext;
  anonRequest: APIRequestContext;
  usersApi: AdminUsersApi;
  anonUsersApi: AdminUsersApi;
  employeesApi: EmployeesApi;

  // Test data
  employee: Employee;
  userFactory: UserFactory;

  /**
   * Opens an isolated browser context with NO stored session. Pass credentials to
   * also log in through the UI. Never log out of the shared Admin storage state —
   * that would invalidate the session for every other worker; use this instead.
   */
  freshSession: (credentials?: { username: string; password: string }) => Promise<FreshSession>;

  /**
   * Automatic failure evidence (CLAUDE.md §4). Specs call `bugEvidence.watch(locator, label)`
   * to mark where a defect shows; on failure the area is outlined and labelled in red and
   * the screenshot is attached as `bug-evidence`. Passing tests are untouched.
   */
  bugEvidence: BugEvidence;
};

export const test = base.extend<Fixtures>({
  bugEvidence: [
    async ({ page }, use, testInfo) => {
      const evidence = new BugEvidence(page);
      await use(evidence);
      await evidence.captureIfFailed(testInfo);
    },
    { auto: true },
  ],
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  forgotPasswordPage: async ({ page }, use) => use(new ForgotPasswordPage(page)),
  systemUsersPage: async ({ page }, use) => use(new SystemUsersPage(page)),
  userFormPage: async ({ page }, use) => use(new UserFormPage(page)),
  appShell: async ({ page }, use) => use(new AppShell(page)),

  adminRequest: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: ENV.baseURL, storageState: ADMIN_STATE });
    await use(ctx);
    await ctx.dispose();
  },
  anonRequest: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: ENV.baseURL });
    await use(ctx);
    await ctx.dispose();
  },
  usersApi: async ({ adminRequest }, use) => use(new AdminUsersApi(adminRequest)),
  anonUsersApi: async ({ anonRequest }, use) => use(new AdminUsersApi(anonRequest)),
  employeesApi: async ({ adminRequest }, use) => use(new EmployeesApi(adminRequest)),

  employee: async ({ employeesApi }, use) => use(await employeesApi.resolveFixtureEmployee()),

  userFactory: async ({ usersApi, employee }, use) => {
    const factory = new UserFactory(usersApi, employee);
    await use(factory);
    await factory.cleanup();
  },

  freshSession: async ({ browser }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (credentials) => {
      // HEAL-002: browser.newContext() inherits the project's `use.storageState`, so in the
      // admin-ui project a "fresh" context was silently already logged in as Admin.
      // An explicit empty state guarantees a session-less context in every project.
      const context = await browser.newContext({
        baseURL: ENV.baseURL,
        viewport: { width: 1280, height: 720 },
        storageState: { cookies: [], origins: [] },
      });
      opened.push(context);
      const page = await context.newPage();
      const loginPage = new LoginPage(page);
      if (credentials) {
        await loginPage.goto();
        await loginPage.loginSuccessfully(credentials.username, credentials.password);
      }
      return { context, page, loginPage, shell: new AppShell(page) };
    });
    for (const ctx of opened) await ctx.close();
  },
});

export { expect };
