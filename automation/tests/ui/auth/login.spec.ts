import { test, expect } from '../../../src/fixtures/test';
import { ENV, ROUTES } from '../../../src/config/env';
import { KNOWN_DEFECTS, MESSAGES } from '../../../src/data/testData';
import { RequestRecorder, ServerErrorRecorder } from '../../../src/utils/network';

const VALIDATE = /\/auth\/validate/;

test.describe('Authentication — Login screen', { tag: ['@auth', '@ui'] }, () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('TC-AUTH-UI-001 Login screen renders all mandatory elements', { tag: '@smoke' }, async ({ loginPage }) => {
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.loginButton).toHaveAttribute('type', 'submit');
    await expect(loginPage.footer).toContainText(ENV.productVersion);
  });

  test('TC-AUTH-UI-003 Valid credentials authenticate successfully', { tag: '@smoke' }, async ({ loginPage, appShell, page }) => {
    await loginPage.login(ENV.adminUsername, ENV.adminPassword);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.dashboard}$`));
    await appShell.expectAuthenticated();
  });

  test('TC-AUTH-UI-004 Login preserves the originally requested protected URL (deep link)', async ({ loginPage, page }) => {
    // D-01: the app preserves the intended destination; the PRD's absolute dashboard redirect needs amending.
    await page.goto(ROUTES.systemUsers);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(loginPage.usernameInput).toBeVisible();

    await loginPage.login(ENV.adminUsername, ENV.adminPassword);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.systemUsers}$`));
  });

  test('TC-AUTH-UI-005 Invalid password is rejected without field disclosure', async ({ loginPage, page }) => {
    const posted = page.waitForResponse((r) => VALIDATE.test(r.url()) && r.request().method() === 'POST');
    await loginPage.login(ENV.adminUsername, 'wrongpass123');
    const response = await posted;
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toMatch(new RegExp(`${ROUTES.login}$`));
    await loginPage.expectInvalidCredentials();
    await expect(loginPage.usernameError).toHaveCount(0);
    await expect(loginPage.passwordError).toHaveCount(0);
  });

  test('TC-AUTH-UI-006 Non-existent username is rejected with the identical message', async ({ loginPage }) => {
    await loginPage.login('NoSuchUser9901', 'anyPassword1');
    await loginPage.expectInvalidCredentials();
  });

  test('TC-AUTH-UI-009 Both fields empty triggers client-side required validation', async ({ loginPage, page }) => {
    const validateCalls = new RequestRecorder(page, VALIDATE);
    await loginPage.submit();

    await expect(loginPage.usernameError).toHaveText(MESSAGES.required);
    await expect(loginPage.passwordError).toHaveText(MESSAGES.required);
    await expect(loginPage.usernameInput).toHaveClass(/oxd-input--error/);
    await expect(loginPage.passwordInput).toHaveClass(/oxd-input--error/);
    expect(validateCalls.urls, 'no request may reach /auth/validate').toEqual([]);
  });

  test('TC-AUTH-UI-010 Username empty with password supplied', async ({ loginPage, page }) => {
    const validateCalls = new RequestRecorder(page, VALIDATE);
    await loginPage.login('', ENV.adminPassword);

    await expect(loginPage.usernameError).toHaveText(MESSAGES.required);
    await expect(loginPage.passwordError).toHaveCount(0);
    expect(validateCalls.urls).toEqual([]);
  });

  test('TC-AUTH-UI-011 Password empty with username supplied', async ({ loginPage, page }) => {
    const validateCalls = new RequestRecorder(page, VALIDATE);
    await loginPage.login(ENV.adminUsername, '');

    await expect(loginPage.passwordError).toHaveText(MESSAGES.required);
    await expect(loginPage.usernameError).toHaveCount(0);
    expect(validateCalls.urls).toEqual([]);
  });

  test('TC-AUTH-UI-012 Whitespace-only input is treated as empty (boundary)', async ({ loginPage, appShell, page }) => {
    await loginPage.login(' ', ' ');
    // Either outcome is acceptable per the test case; authentication must never happen.
    await expect(loginPage.usernameError.or(loginPage.errorBanner).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(appShell.userDropdownName).toHaveCount(0);
  });

  test('TC-AUTH-UI-013 Username case-sensitivity is deterministic (negative)', async ({ loginPage, appShell, page }, testInfo) => {
    const serverErrors = new ServerErrorRecorder(page);
    await loginPage.login(ENV.adminUsername.toLowerCase(), ENV.adminPassword);

    // Record the observed casing rule — the TC defines it from this observation.
    await expect(loginPage.errorBanner.or(appShell.userDropdownName)).toBeVisible();
    const caseInsensitive = await appShell.userDropdownName.isVisible();
    testInfo.annotations.push({
      type: 'observed',
      description: caseInsensitive ? 'Username is case-INSENSITIVE: "admin" authenticated' : 'Username is case-sensitive: refused',
    });
    if (!caseInsensitive) await loginPage.expectInvalidCredentials();
    expect(serverErrors.errors).toEqual([]);
  });

  test('TC-AUTH-UI-014 Password is case-sensitive (negative)', async ({ loginPage }) => {
    await loginPage.login(ENV.adminUsername, ENV.adminPassword.toUpperCase());
    await loginPage.expectInvalidCredentials();
  });

  test('TC-AUTH-UI-015 Leading and trailing whitespace around a valid username (boundary)', async ({ loginPage, appShell, page }, testInfo) => {
    const serverErrors = new ServerErrorRecorder(page);
    await loginPage.login(` ${ENV.adminUsername} `, ENV.adminPassword);

    await expect(loginPage.errorBanner.or(appShell.userDropdownName)).toBeVisible();
    const trimmed = await appShell.userDropdownName.isVisible();
    testInfo.annotations.push({
      type: 'observed',
      description: trimmed ? 'Username is trimmed: login succeeded' : 'Username is not trimmed: Invalid credentials',
    });
    if (!trimmed) await loginPage.expectInvalidCredentials();
    expect(serverErrors.errors).toEqual([]);
  });

  test('TC-AUTH-UI-016 Very long username is handled without server error (boundary)', async ({ loginPage, page }) => {
    const serverErrors = new ServerErrorRecorder(page);
    await loginPage.login('a'.repeat(500), ENV.adminPassword);
    await loginPage.expectInvalidCredentials();
    expect(serverErrors.errors).toEqual([]);
  });
});

test.describe('Authentication — Disabled accounts', { tag: ['@auth', '@ui', '@security'] }, () => {
  test(
    'TC-AUTH-UI-007 Disabled account must not be distinguishable from invalid credentials',
    { annotation: { type: 'issue', description: KNOWN_DEFECTS.disabledAccountDisclosure } },
    async ({ loginPage, userFactory, bugEvidence }) => {
      test.fail(true, KNOWN_DEFECTS.disabledAccountDisclosure);
      bugEvidence.watch(loginPage.errorBanner, 'Defect: disabled account shows "Account disabled" instead of the generic "Invalid credentials"');
      const disabled = await userFactory.create({ enabled: false, prefix: 'qadis' });

      await loginPage.goto();
      await loginPage.login(disabled.username, disabled.password);
      // Expected generic message — the build answers "Account disabled" (D-02).
      await expect(loginPage.errorBanner).toHaveText(MESSAGES.invalidCredentials, { timeout: 10_000 });
    },
  );

  test('TC-AUTH-UI-008 Disabled account with a wrong password (contrast case for D-02)', async ({ loginPage, userFactory, page }) => {
    const disabled = await userFactory.create({ enabled: false, prefix: 'qadis' });

    await loginPage.goto();
    await loginPage.login(disabled.username, 'totallyWrong1');
    await loginPage.expectInvalidCredentials();
    await expect(page.getByText(MESSAGES.accountDisabled)).toHaveCount(0);
  });
});
