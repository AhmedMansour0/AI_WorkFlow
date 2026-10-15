import { expect, type Locator, type Page } from '@playwright/test';
import { ENV, ROUTES } from '../config/env';

/**
 * GET /web/index.php/auth/login — server-rendered <form> POST to /auth/validate
 * (not XHR). Inputs have no id / label association / `required` attribute, so
 * they are anchored on `name` (exploration §1.2). Validation is client-side JS.
 */
export class LoginPage {
  readonly form: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly csrfToken: Locator;
  readonly loginButton: Locator;
  readonly usernameError: Locator;
  readonly passwordError: Locator;
  readonly errorBanner: Locator;
  readonly forgotPasswordLink: Locator;
  readonly footer: Locator;

  constructor(readonly page: Page) {
    this.form = page.locator('form[action$="/auth/validate"]');
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.csrfToken = page.locator('input[name="_token"]');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.usernameError = page
      .locator('.oxd-input-group', { has: page.locator('input[name="username"]') })
      .locator('.oxd-input-field-error-message');
    this.passwordError = page
      .locator('.oxd-input-group', { has: page.locator('input[name="password"]') })
      .locator('.oxd-input-field-error-message');
    // Banner carries role="alert" (exploration §1.2).
    this.errorBanner = page.locator('.oxd-alert.oxd-alert--error .oxd-alert-content-text');
    // Rendered as a <p>, NOT an <a> — no link role available.
    this.forgotPasswordLink = page.locator('.orangehrm-login-forgot');
    this.footer = page.locator('.orangehrm-login-footer');
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.login);
    await expect(this.usernameInput).toBeVisible();
  }

  async fillCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.loginButton.click();
  }

  async login(username: string, password: string): Promise<void> {
    await this.fillCredentials(username, password);
    await this.submit();
  }

  /** Login and wait for the browser to leave the login screen. */
  async loginSuccessfully(username = ENV.adminUsername, password = ENV.adminPassword): Promise<void> {
    await this.login(username, password);
    await this.page.waitForURL((url) => !url.pathname.endsWith('/auth/login'));
  }

  async expectInvalidCredentials(): Promise<void> {
    await expect(this.errorBanner).toHaveText('Invalid credentials');
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.login}$`));
  }

  async readCsrfToken(): Promise<string> {
    await expect(this.csrfToken).toHaveAttribute('value', /.+/);
    return (await this.csrfToken.getAttribute('value')) ?? '';
  }
}
