import { test, expect } from '../../../src/fixtures/test';
import { ENV, ROUTES } from '../../../src/config/env';
import { RequestRecorder } from '../../../src/utils/network';

/**
 * FR-AUTH-6 / FR-AUTH-7. Every test that logs out does so from its OWN
 * fresh session (freshSession fixture) — logging out of the shared Admin storage
 * state would invalidate it for every other worker.
 */
test.describe('Authentication — Route protection', { tag: ['@auth', '@ui', '@security'] }, () => {
  test('TC-AUTH-UI-023 Protected route is denied while logged out', async ({ page, loginPage, context }) => {
    await context.clearCookies();
    const apiCalls = new RequestRecorder(page, /\/api\/v2\//);

    const response = await page.goto(ROUTES.systemUsers);
    const firstHop = response?.request().redirectedFrom();
    expect(firstHop, 'protected URL must be answered with a redirect').toBeTruthy();
    expect((await firstHop!.response())?.status()).toBe(302);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(loginPage.usernameInput).toBeVisible();
    expect(apiCalls.urls, 'no /api/v2/ data requests may be issued').toEqual([]);
  });

  test('TC-AUTH-UI-024 A second protected route is likewise denied while logged out', async ({ page, loginPage, userFormPage, context }) => {
    await context.clearCookies();
    const response = await page.goto(ROUTES.saveSystemUser);

    expect((await response?.request().redirectedFrom()?.response())?.status()).toBe(302);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(userFormPage.heading).toHaveCount(0);
  });
});

test.describe('Authentication — Logout and session', { tag: ['@auth', '@ui', '@security'] }, () => {
  const admin = { username: ENV.adminUsername, password: ENV.adminPassword };

  test('TC-AUTH-UI-025 Logout terminates the session', async ({ freshSession }) => {
    const { page, shell, loginPage } = await freshSession(admin);

    const logoutResponse = page.waitForResponse((r) => r.url().endsWith(ROUTES.logout));
    await shell.logout();
    const response = await logoutResponse;

    expect(response.status()).toBe(302);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(loginPage.usernameInput).toBeVisible();
  });

  test('TC-AUTH-UI-026 Browser Back after logout does not restore authenticated content', async ({ freshSession }) => {
    const { page, shell, loginPage } = await freshSession(admin);
    await shell.logout();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(shell.userDropdownName).toHaveCount(0);
  });
});
