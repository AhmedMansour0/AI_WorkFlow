import { test, expect } from '../../../src/fixtures/test';
import { API_BASE, ENV, ROUTES } from '../../../src/config/env';
import { MESSAGES } from '../../../src/data/testData';
import { RequestRecorder } from '../../../src/utils/network';

const SESSION_COOKIE = 'orangehrm';

/**
 * FR-AUTH-6 / FR-AUTH-7 / NFR-SEC. Every test that logs out does so from its OWN
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

  test('TC-AUTH-UI-027 Session identifier is rotated on logout', async ({ freshSession }) => {
    const { context, shell } = await freshSession(admin);
    const before = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(before?.value, 'authenticated session cookie').toBeTruthy();

    await shell.logout();
    const after = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);

    expect(after?.value).toBeTruthy();
    expect(after!.value).not.toBe(before!.value);
  });

  test('TC-AUTH-UI-028 Session cookie carries the correct security attributes', async ({ freshSession }) => {
    const { context, page } = await freshSession(admin);
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);

    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/web', expires: -1 });
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });

  test('TC-AUTH-UI-029 Login POST is rejected when the CSRF token is tampered with', async ({ freshSession }) => {
    const { page, loginPage } = await freshSession();
    await loginPage.goto();
    await loginPage.readCsrfToken(); // a genuine token was rendered for this session

    // page.request shares the browser context's cookie jar, so only the token differs.
    const response = await page.request.post(ROUTES.validate, {
      form: { _token: 'tampered-token-value', username: ENV.adminUsername, password: ENV.adminPassword },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toMatch(new RegExp(`${ROUTES.login}$`));

    const probe = await page.request.get(`${API_BASE}/admin/users`, { params: { limit: 1 } });
    expect(probe.status(), 'no authenticated session may be established').toBe(401);
    expect(await probe.json()).toMatchObject({ error: { message: MESSAGES.sessionExpired } });
  });

  test('TC-AUTH-UI-030 Security response headers are present on authenticated pages', async ({ freshSession }, testInfo) => {
    const { page } = await freshSession(admin);
    const response = await page.goto(ROUTES.systemUsers);
    const headers = response!.headers();

    expect(headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toBeTruthy();

    // Review findings — recorded, not asserted, per the test case.
    const findings = [
      !headers['x-frame-options'] && 'x-frame-options is absent',
      !headers['referrer-policy'] && 'referrer-policy is absent',
      /'unsafe-inline'|'unsafe-eval'/.test(headers['content-security-policy'] ?? '') && "CSP allows 'unsafe-inline'/'unsafe-eval'",
    ].filter(Boolean) as string[];
    for (const description of findings) testInfo.annotations.push({ type: 'review-finding', description });
  });
});
