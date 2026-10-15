import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { API, ROUTES } from '../config/env';
import { Autocomplete } from '../components/Autocomplete';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';

export interface UserFormData {
  role?: 'Admin' | 'ESS';
  employee?: { hint: string; firstName: string; lastName: string };
  status?: 'Enabled' | 'Disabled';
  username?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Add User (/admin/saveSystemUser) and Edit User (/admin/saveSystemUser/{id}).
 * None of the inputs have a name/id — every field is reached via its label.
 * In Edit mode Password/Confirm are hidden behind the "Change Password ?" toggle,
 * and every field is populated asynchronously after GET /admin/users/{id}.
 */
export class UserFormPage {
  readonly toast: Toast;
  readonly heading: Locator;
  readonly form: Locator;
  readonly role: FormField;
  readonly employee: Autocomplete;
  readonly status: FormField;
  readonly username: FormField;
  readonly password: FormField;
  readonly confirmPassword: FormField;
  readonly changePassword: FormField;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(readonly page: Page) {
    this.toast = new Toast(page);
    this.form = page.locator('form.oxd-form');
    this.heading = page.getByRole('heading', { name: /^(Add|Edit) User$/ });
    this.role = new FormField(page, 'User Role', this.form);
    this.employee = new Autocomplete(page, 'Employee Name', this.form);
    this.status = new FormField(page, 'Status', this.form);
    this.username = new FormField(page, 'Username', this.form);
    this.password = new FormField(page, 'Password', this.form);
    this.confirmPassword = new FormField(page, 'Confirm Password', this.form);
    this.changePassword = new FormField(page, 'Change Password ?', this.form);
    this.saveButton = this.form.getByRole('button', { name: 'Save' });
    this.cancelButton = this.form.getByRole('button', { name: 'Cancel' });
  }

  async gotoAdd(): Promise<void> {
    await this.page.goto(ROUTES.saveSystemUser);
    await expect(this.heading).toHaveText('Add User');
  }

  async gotoEdit(id: number, expectedUsername: string): Promise<void> {
    await this.page.goto(`${ROUTES.saveSystemUser}/${id}`);
    await this.waitForEditLoaded(expectedUsername);
  }

  /** Edit form fields are filled asynchronously — wait for the record before touching anything. */
  async waitForEditLoaded(expectedUsername: string): Promise<void> {
    await expect(this.heading).toHaveText('Edit User');
    await expect(this.username.input).toHaveValue(expectedUsername);
  }

  /**
   * Types a username and waits for the async uniqueness probe
   * (GET /admin/validation/user-name) for exactly that value to answer.
   */
  async enterUsername(value: string): Promise<void> {
    const probe = this.page.waitForResponse(
      (r) => r.url().includes(API.usernameValidation) && new URL(r.url()).searchParams.get('userName') === value,
    );
    await this.username.fillAndBlur(value);
    await probe;
  }

  async fill(data: UserFormData): Promise<void> {
    if (data.role) await this.role.choose(data.role);
    if (data.employee) await this.employee.pick(data.employee.hint, data.employee.firstName, data.employee.lastName);
    if (data.status) await this.status.choose(data.status);
    if (data.username !== undefined) await this.enterUsername(data.username);
    if (data.password !== undefined) await this.password.fillAndBlur(data.password);
    if (data.confirmPassword !== undefined) await this.confirmPassword.fillAndBlur(data.confirmPassword);
  }

  async enableChangePassword(): Promise<void> {
    await this.changePassword.checkbox.click();
    await expect(this.password.input).toBeVisible();
  }

  /** Clicks Save and returns the write request (POST create / PUT update) it fires. */
  async save(method: 'POST' | 'PUT'): Promise<Request> {
    const write = this.page.waitForRequest((r) => r.url().includes(API.users) && r.method() === method);
    await this.saveButton.click();
    return write;
  }

  async saveAndReturnToList(method: 'POST' | 'PUT', toastMessage: string): Promise<Request> {
    const request = await this.save(method);
    await this.toast.expectSuccess(toastMessage);
    await this.page.waitForURL(`**${ROUTES.systemUsers}`);
    return request;
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.page.waitForURL(`**${ROUTES.systemUsers}`);
  }

  /** All validation messages currently shown in the form. */
  get errors(): Locator {
    return this.form.locator('.oxd-input-field-error-message');
  }
}
