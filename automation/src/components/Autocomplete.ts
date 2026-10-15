import { expect, type Locator, type Page } from '@playwright/test';
import { API } from '../config/env';
import { FormField } from './FormField';

/**
 * "Employee Name" autocomplete (placeholder "Type for hints...").
 * Backed by GET /api/v2/pim/employees?nameOrId=… (exploration §3.5). While the
 * request is in flight the dropdown shows a transient "Searching...." option —
 * never click the first option blindly.
 */
export class Autocomplete extends FormField {
  readonly dropdown: Locator;
  readonly options: Locator;

  constructor(page: Page, label: string, scope?: Locator) {
    super(page, label, scope);
    this.dropdown = page.locator('.oxd-autocomplete-dropdown');
    this.options = this.dropdown.getByRole('option').filter({ hasNotText: /Searching/ });
  }

  /** Types a hint and waits for the backing employee search to answer. */
  async type(hint: string): Promise<void> {
    const searched = this.page.waitForResponse(
      (r) => r.url().includes(API.employees) && r.url().includes(`nameOrId=${encodeURIComponent(hint)}`),
    );
    await this.input.fill(hint);
    await searched;
  }

  /** Types a hint, waits for real suggestions and picks the one matching first + last name. */
  async pick(hint: string, firstName: string, lastName: string): Promise<void> {
    await this.type(hint);
    const option = this.options.filter({ hasText: firstName }).filter({ hasText: lastName }).first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.dropdown).toBeHidden();
    await expect(this.input).toHaveValue(new RegExp(`${firstName}.*${lastName}`));
  }
}
