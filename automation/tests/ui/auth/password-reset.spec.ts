import { test, expect } from '../../../src/fixtures/test';
import { ROUTES } from '../../../src/config/env';
import { KNOWN_DEFECTS } from '../../../src/data/testData';
import { RequestRecorder } from '../../../src/utils/network';

/**
 * FR-AUTH-5. Reset requests are only ever submitted for this suite's own
 * disposable users or for a non-existent name — never for the shared Admin.
 * Email delivery is out of scope (OOS-12).
 */
test.describe('Authentication — Forgot password', { tag: ['@auth', '@ui'] }, () => {
  test('TC-AUTH-UI-019 Forgot-password entry point navigates to the reset screen', async ({ loginPage, forgotPasswordPage, page }) => {
    await loginPage.goto();
    await loginPage.forgotPasswordLink.click();

    await expect(page).toHaveURL(new RegExp(`${ROUTES.requestPasswordResetCode}$`));
    await expect(forgotPasswordPage.heading).toBeVisible();
    await expect(forgotPasswordPage.textInputs).toHaveCount(1);
    await expect(forgotPasswordPage.usernameInput).toBeVisible();
  });

  test(
    'TC-AUTH-UI-020 Reset Password screen accepts a username and submits',
    { annotation: { type: 'issue', description: KNOWN_DEFECTS.resetExistingUser504 } },
    async ({ forgotPasswordPage, userFactory, page, bugEvidence }) => {
    test.fail(true, KNOWN_DEFECTS.resetExistingUser504);
    test.setTimeout(150_000);
    bugEvidence.watch(forgotPasswordPage.serverErrorHeading, 'Defect: password reset for an existing user returned HTTP 504 after ~60 s, no confirmation');
    const user = await userFactory.create({ prefix: 'qarst' });

    await forgotPasswordPage.goto();
    await expect(forgotPasswordPage.form).toHaveAttribute('action', new RegExp(`${ROUTES.requestResetPassword}$`));
    const response = await forgotPasswordPage.requestReset(user.username);

    expect(response.request().method()).toBe('POST');
    expect(response.status(), 'reset POST must redirect to the confirmation screen').toBe(302);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.sendPasswordReset}$`));
    await expect(forgotPasswordPage.confirmationHeading).toBeVisible();
    },
  );

  test('TC-AUTH-UI-021 Reset Password Cancel returns to the login screen', async ({ forgotPasswordPage, loginPage, page }) => {
    const resetPosts = new RequestRecorder(page, /\/auth\/requestResetPassword/);
    await forgotPasswordPage.goto();
    await forgotPasswordPage.cancelButton.click();

    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(loginPage.usernameInput).toBeVisible();
    expect(resetPosts.urls, 'Cancel must not submit a reset request').toEqual([]);
  });
});
