import { test, expect } from '../../../src/fixtures/test';
import { ROUTES } from '../../../src/config/env';
import { MESSAGES } from '../../../src/data/testData';
import { RequestRecorder } from '../../../src/utils/network';

/**
 * FR-ADM-1 list / filter behaviour. Runs on the shared Admin storage state.
 * Record counts on the demo are volatile (D-10): assertions compare the counter
 * against what was rendered in the same response, never against constants.
 */
test.describe('User Management — System Users list', { tag: ['@adm', '@ui'] }, () => {
  test('TC-ADM-UI-001 System Users list renders for an Admin user', { tag: '@smoke' }, async ({ page, systemUsersPage }) => {
    await page.goto(ROUTES.dashboard);
    await systemUsersPage.shell.openModule('Admin');
    await expect(page).toHaveURL(new RegExp(`${ROUTES.systemUsers}$`));
    await systemUsersPage.waitForTable();

    await expect(systemUsersPage.shell.breadcrumb).toContainText('Admin');
    await expect(systemUsersPage.shell.breadcrumb).toContainText('User Management');
    for (const column of ['Username', 'User Role', 'Employee Name', 'Status']) {
      await expect(systemUsersPage.tableHeader).toContainText(column);
    }
    await expect(systemUsersPage.rows.first()).toBeVisible();
  });

  test('TC-ADM-UI-002 Records-found counter matches the number of rows rendered', async ({ systemUsersPage }) => {
    await systemUsersPage.goto();
    // HEAL-004: TC-ADM-UI-032 seeds users in parallel, so the total can exceed one page.
    // The counter/rows relationship still holds on page 1: rows = min(counter, page size).
    const counter = await systemUsersPage.recordsFoundCount();
    expect(counter).toBeGreaterThan(0);
    await expect(systemUsersPage.rows).toHaveCount(Math.min(counter, 50));
  });

  test('TC-ADM-UI-003 Filter the user list by Username', async ({ systemUsersPage }) => {
    await systemUsersPage.goto();
    const response = await systemUsersPage.filterByUsername('Admin');

    expect(new URL(response.url()).searchParams.get('username')).toBe('Admin');
    await expect(systemUsersPage.rowsWhere('username', 'Admin')).not.toHaveCount(0);
    await expect(systemUsersPage.rows).toHaveCount(await systemUsersPage.recordsFoundCount());
    // Every listed row must match the filter (case-insensitive match is tolerated).
    await expect(systemUsersPage.rowsWhere('username', /^\s*admin\s*$/i, true)).toHaveCount(0);
  });

  test('TC-ADM-UI-004 Filter the user list by User Role', async ({ systemUsersPage }) => {
    await systemUsersPage.goto();
    await systemUsersPage.ensureFiltersExpanded();
    await systemUsersPage.roleFilter.choose('Admin');
    const response = await systemUsersPage.search();

    expect(new URL(response.url()).searchParams.get('userRoleId')).toBe('1');
    await expect(systemUsersPage.rows).not.toHaveCount(0);
    await expect(systemUsersPage.rowsWhere('role', 'Admin', true)).toHaveCount(0);
  });

  test('TC-ADM-UI-005 Filter the user list by Status', async ({ systemUsersPage, userFactory }) => {
    const disabled = await userFactory.create({ enabled: false, prefix: 'qadis' });

    await systemUsersPage.goto();
    await systemUsersPage.ensureFiltersExpanded();
    await systemUsersPage.statusFilter.choose('Disabled');
    await systemUsersPage.search();

    await expect(systemUsersPage.rowByUsername(disabled.username)).toHaveCount(1);
    await expect(systemUsersPage.rowsWhere('status', 'Disabled', true)).toHaveCount(0);
  });

  test('TC-ADM-UI-006 Filter the user list by Employee Name using autocomplete', async ({ systemUsersPage, userFactory, employee }) => {
    const linked = await userFactory.create({ prefix: 'qaemp' });
    const hint = employee.firstName.slice(0, 2);

    await systemUsersPage.goto();
    await systemUsersPage.ensureFiltersExpanded();
    await systemUsersPage.employeeFilter.type(hint);
    await expect(systemUsersPage.employeeFilter.options.first()).toBeVisible();
    await systemUsersPage.employeeFilter.pick(hint, employee.firstName, employee.lastName);
    const response = await systemUsersPage.search();

    expect(new URL(response.url()).searchParams.get('empNumber')).toBe(String(employee.empNumber));
    await expect(systemUsersPage.rowByUsername(linked.username)).toHaveCount(1);
    await expect(systemUsersPage.rowsWhere('employee', new RegExp(employee.firstName), true)).toHaveCount(0);
  });

  test('TC-ADM-UI-007 Employee Name autocomplete rejects a free-text value that matches no employee', async ({ systemUsersPage, page }) => {
    await systemUsersPage.goto();
    await systemUsersPage.ensureFiltersExpanded();
    await systemUsersPage.employeeFilter.type('ZZNoSuchEmployee');

    const listCalls = new RequestRecorder(page, /\/api\/v2\/admin\/users\?/);
    await systemUsersPage.searchButton.click();

    await systemUsersPage.employeeFilter.expectError(MESSAGES.invalid);
    expect(listCalls.urls, 'no search may be performed').toEqual([]);
  });

  test('TC-ADM-UI-008 Reset clears all filter criteria', async ({ systemUsersPage }) => {
    await systemUsersPage.goto();
    await systemUsersPage.ensureFiltersExpanded();
    await systemUsersPage.usernameFilter.fill('Admin');
    await systemUsersPage.roleFilter.choose('Admin');
    await systemUsersPage.search();

    const response = await systemUsersPage.reset();

    await expect(systemUsersPage.usernameFilter.input).toHaveValue('');
    await expect(systemUsersPage.roleFilter.selectText).toHaveText('-- Select --');
    await expect(systemUsersPage.statusFilter.selectText).toHaveText('-- Select --');
    await expect(systemUsersPage.employeeFilter.input).toHaveValue('');
    const params = new URL(response.url()).searchParams;
    for (const key of ['username', 'userRoleId', 'status', 'empNumber']) expect(params.has(key), key).toBe(false);
    await expect(systemUsersPage.rows).not.toHaveCount(0);
  });

  test('TC-ADM-UI-009 Filter combination returning no matches shows an empty state (boundary)', async ({ systemUsersPage, page }) => {
    const serverErrors: string[] = [];
    page.on('response', (r) => r.status() >= 500 && serverErrors.push(r.url()));

    await systemUsersPage.goto();
    await systemUsersPage.filterByUsername('ZZZnoMatch9901');

    // Build renders "No Records Found" in place of "(0) Records Found" — both mean zero.
    await expect(systemUsersPage.recordsFound).toHaveText(/^(\(0\) Records Found|No Records Found)$/);
    await systemUsersPage.toast.expectInfo(MESSAGES.noRecords);
    await expect(systemUsersPage.rows).toHaveCount(0);
    expect(serverErrors).toEqual([]);
  });

  test('TC-ADM-UI-032 User list pagination beyond the default page size (boundary)', { tag: '@slow' }, async ({ systemUsersPage, usersApi, userFactory }) => {
    test.setTimeout(240_000);
    // Precondition: > 50 users. Seed disposable users only if the demo is below it.
    const total = (await (await usersApi.list({ limit: 1 })).json()).meta.total as number;
    const missing = Math.max(0, 51 - total);
    test.skip(missing > 20, `Seeding ${missing} users onto the shared demo is excessive`);
    if (missing > 0) await userFactory.createMany(missing, { prefix: 'qapage' });

    await systemUsersPage.goto();
    await expect(systemUsersPage.rows).toHaveCount(50);
    await expect(systemUsersPage.pagination).toBeVisible();
    const pageOne = await systemUsersPage.columnCells('username').allInnerTexts();

    await systemUsersPage.pagination.getByRole('button', { name: '2', exact: true }).click();
    await systemUsersPage.waitForTable();
    await expect(systemUsersPage.rows).not.toHaveCount(0);
    await expect(systemUsersPage.rows.first()).not.toHaveText(new RegExp(pageOne[0]));
    const pageTwo = await systemUsersPage.columnCells('username').allInnerTexts();

    expect(pageTwo.filter((u) => pageOne.includes(u)), 'no record may repeat across pages').toEqual([]);
  });

  test('TC-ADM-UI-034 Admin module navigation exposes the documented submenus', async ({ systemUsersPage }) => {
    await systemUsersPage.goto();
    const { shell } = systemUsersPage;
    for (const tab of ['User Management', 'Job', 'Organization']) await expect(shell.topbarTab(tab)).toBeVisible();
    // At narrow widths the remaining tabs collapse into "More"; at 1280px they render inline.
    await expect(shell.topbarTab('More').or(shell.topbarTab('Configuration'))).toBeVisible();
  });

  test('TC-ADM-API-041 Register OAuth client screen loads under Admin Configuration', async ({ systemUsersPage, page }) => {
    await systemUsersPage.goto();
    await systemUsersPage.shell.openTopbarMenu('Configuration', 'Register OAuth Client');

    await expect(page).toHaveURL(new RegExp(`${ROUTES.registerOAuthClient}$`));
    await expect(page.getByRole('heading', { name: 'OAuth Client List' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  });
});
