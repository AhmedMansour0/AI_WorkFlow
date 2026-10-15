import type { Locator, Page } from '@playwright/test';

/** "Are you Sure?" delete confirmation (`.orangehrm-dialog-popup`, role="document"). */
export class ConfirmDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.root = page.locator('.orangehrm-dialog-popup');
    this.title = this.root.locator('.oxd-text--card-title');
    this.confirmButton = this.root.getByRole('button', { name: 'Yes, Delete' });
    this.cancelButton = this.root.getByRole('button', { name: 'No, Cancel' });
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
