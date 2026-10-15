import { expect, type Locator, type Page } from '@playwright/test';
import { ROUTES } from '../config/env';

/** Authenticated application chrome: side menu, breadcrumb, module top-bar and user dropdown. */
export class AppShell {
  readonly sideMenu: Locator;
  readonly breadcrumb: Locator;
  readonly topbarNav: Locator;
  readonly userDropdownTab: Locator;
  readonly userDropdownName: Locator;
  readonly logoutItem: Locator;
  readonly pageTitle: Locator;

  constructor(private readonly page: Page) {
    this.sideMenu = page.locator('.oxd-main-menu');
    this.breadcrumb = page.locator('.oxd-topbar-header-breadcrumb');
    this.topbarNav = page.locator('.oxd-topbar-body-nav');
    this.userDropdownTab = page.locator('.oxd-userdropdown-tab');
    this.userDropdownName = page.locator('.oxd-userdropdown-name');
    this.logoutItem = page.getByRole('menuitem', { name: 'Logout' });
    this.pageTitle = page.locator('.oxd-layout-context h6').first();
  }

  topbarTab(name: string): Locator {
    return this.topbarNav.locator('.oxd-topbar-body-nav-tab').filter({ hasText: name });
  }

  topbarMenuItem(name: string): Locator {
    return this.topbarNav.getByRole('menuitem', { name, exact: true });
  }

  async openModule(name: string): Promise<void> {
    await this.sideMenu.getByRole('link', { name, exact: true }).click();
  }

  async openTopbarMenu(tab: string, item: string): Promise<void> {
    await this.topbarTab(tab).click();
    await this.topbarMenuItem(item).click();
  }

  async logout(): Promise<void> {
    await this.userDropdownTab.click();
    await this.logoutItem.click();
    await this.page.waitForURL(`**${ROUTES.login}`);
  }

  async expectAuthenticated(): Promise<void> {
    await expect(this.userDropdownName).toBeVisible();
    await expect(this.userDropdownName).not.toHaveText('');
  }
}
