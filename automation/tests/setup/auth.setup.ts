import { test as setup, expect } from '@playwright/test';
import { ADMIN_STATE, ENV, ROUTES } from '../../src/config/env';
import { LoginPage } from '../../src/pages/LoginPage';

/**
 * Logs in once as Admin and persists the session for the admin-ui and api
 * projects. The session cookie is HttpOnly and path=/web (exploration §1.5),
 * which storageState captures correctly.
 */
setup('authenticate as Admin', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(ENV.adminUsername, ENV.adminPassword);
  await page.waitForURL(`**${ROUTES.dashboard}`);
  await expect(page.locator('.oxd-userdropdown-name')).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
