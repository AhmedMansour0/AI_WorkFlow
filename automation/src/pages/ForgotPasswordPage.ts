import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { ROUTES } from '../config/env';

/**
 * GET /auth/requestPasswordResetCode — form POST to /auth/requestResetPassword,
 * which 302s to /auth/sendPasswordReset ("Reset Password link sent successfully").
 */
export class ForgotPasswordPage {
  readonly heading: Locator;
  readonly form: Locator;
  readonly usernameInput: Locator;
  readonly textInputs: Locator;
  readonly cancelButton: Locator;
  readonly resetButton: Locator;
  readonly confirmationHeading: Locator;
  readonly confirmationCard: Locator;
  /** Top heading of a server error page (e.g. nginx "504 Gateway Time-out"). */
  readonly serverErrorHeading: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Reset Password', exact: true });
    this.form = page.locator('form[action$="/auth/requestResetPassword"]');
    this.usernameInput = page.locator('input[name="username"]');
    this.textInputs = this.form.locator('input:not([type="hidden"])');
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.resetButton = page.getByRole('button', { name: 'Reset Password' });
    this.confirmationHeading = page.getByRole('heading', { name: 'Reset Password link sent successfully' });
    this.confirmationCard = page.locator('.orangehrm-card-container');
    this.serverErrorHeading = page.getByRole('heading', { level: 1 });
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.requestPasswordResetCode);
    await expect(this.usernameInput).toBeVisible();
  }

  /**
   * Submits a username and returns the raw POST /auth/requestResetPassword response.
   * The click does not wait for the navigation (HEAL-001): for an existing user the
   * server can take up to 60 s and answer 504, and the caller must see that response
   * instead of a misleading click timeout. Callers assert the status, then the URL.
   */
  async requestReset(username: string): Promise<Response> {
    const posted = this.page.waitForResponse(
      (r) => r.url().endsWith(ROUTES.requestResetPassword) && r.request().method() === 'POST',
      { timeout: 75_000 },
    );
    await this.usernameInput.fill(username);
    await this.resetButton.click({ noWaitAfter: true });
    return posted;
  }
}
