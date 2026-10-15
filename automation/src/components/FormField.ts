import { expect, type Locator, type Page } from '@playwright/test';

/**
 * One labelled OXD form control (`.oxd-input-group`).
 *
 * The Add/Edit User inputs carry no `name`, `id` or label association
 * (exploration §2.2), so every field is anchored on its visible `<label>` text
 * and scoped to the surrounding input group.
 *
 * D-09 — validation is DEBOUNCED. Reading the error immediately after typing
 * returns the PREVIOUS value's message, and asserting "no error" immediately
 * passes vacuously before the validator has even run. Use `settledError()` /
 * `expectNoError()` for negative checks; positive checks use retrying `toHaveText`.
 */
export class FormField {
  readonly root: Locator;
  readonly input: Locator;
  readonly error: Locator;
  readonly selectText: Locator;
  readonly checkbox: Locator;

  constructor(protected readonly page: Page, readonly label: string, scope?: Locator) {
    const container = scope ?? page.locator('form');
    this.root = container
      .locator('.oxd-input-group')
      .filter({ has: page.locator(`label.oxd-label:text-is("${label}")`) });
    this.input = this.root.locator('input').first();
    this.error = this.root.locator('.oxd-input-field-error-message');
    this.selectText = this.root.locator('.oxd-select-text');
    this.checkbox = this.root.locator('.oxd-checkbox-input');
  }

  async fill(value: string): Promise<void> {
    await this.input.fill(value);
  }

  /** Fill and move focus away so blur-triggered validation fires. */
  async fillAndBlur(value: string): Promise<void> {
    await this.input.fill(value);
    await this.input.blur();
  }

  /**
   * OXD select is a custom widget, NOT a <select>: `selectOption()` does not work.
   * Open it and pick the role=option from the role=listbox it renders.
   */
  async choose(option: string): Promise<void> {
    await this.selectText.click();
    const listbox = this.page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await listbox.getByRole('option', { name: option, exact: true }).click();
    await expect(this.selectText).toHaveText(option);
  }

  /**
   * Waits until the field's error text has stopped changing for `quietMs`
   * (debounce settled, D-09) and returns it ('' when no message is shown).
   */
  async settledError(quietMs = 1_500): Promise<string> {
    let last: string | undefined;
    let stableSince = Date.now();
    await expect
      .poll(
        async () => {
          const current = (await this.error.count()) ? (await this.error.innerText()).trim() : '';
          if (current !== last) {
            last = current;
            stableSince = Date.now();
          }
          return Date.now() - stableSince;
        },
        { intervals: [250], timeout: 15_000, message: `validation on "${this.label}" never settled (D-09)` },
      )
      .toBeGreaterThanOrEqual(quietMs);
    return last ?? '';
  }

  async expectNoError(): Promise<void> {
    expect(await this.settledError(), `"${this.label}" should show no validation message`).toBe('');
    await expect(this.error).toHaveCount(0);
  }

  async expectError(message: string): Promise<void> {
    await expect(this.error).toHaveText(message);
  }
}
