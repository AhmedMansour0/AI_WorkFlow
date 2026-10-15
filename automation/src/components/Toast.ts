import { expect, type Locator, type Page } from '@playwright/test';

/** OXD toast notifications (`.oxd-toast`, aria-live="assertive"). */
export class Toast {
  readonly all: Locator;

  constructor(page: Page) {
    this.all = page.locator('.oxd-toast');
  }

  withMessage(text: string | RegExp): Locator {
    return this.all.filter({ has: this.all.page().locator('.oxd-text--toast-message', { hasText: text }) });
  }

  async expectSuccess(text: string | RegExp): Promise<void> {
    await expect(this.withMessage(text).first()).toHaveClass(/oxd-toast--success/);
  }

  /** Error toasts auto-dismiss after ~2.7 s — always assert straight after the triggering action. */
  async expectError(text: string | RegExp): Promise<void> {
    await expect(this.withMessage(text).first()).toHaveClass(/oxd-toast--error/);
  }

  async expectInfo(text: string | RegExp): Promise<void> {
    await expect(this.withMessage(text).first()).toHaveClass(/oxd-toast--info/);
  }
}
