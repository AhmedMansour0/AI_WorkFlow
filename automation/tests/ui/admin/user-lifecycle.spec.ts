import { test, expect } from '../../../src/fixtures/test';
import { ROLE, ROUTES } from '../../../src/config/env';
import { MESSAGES, VALID_PASSWORD, uniqueUsername } from '../../../src/data/testData';
import { RequestRecorder } from '../../../src/utils/network';
import type { SystemUser } from '../../../src/api/AdminUsersApi';
import { SystemUsersPage } from '../../../src/pages/SystemUsersPage';

/**
 * FR-ADM-1 / FR-ADM-2 / FR-ADM-3 — create, edit, enable/disable, delete.
 * Every record touched here is a disposable fixture created by this suite and
 * deleted at teardown (D-10). The shared Admin account is never edited/deleted.
 */
test.describe('User Management — User lifecycle', { tag: ['@adm', '@ui'] }, () => {
  test('TC-ADM-UI-011 Create a new system user successfully (positive, end to end)', { tag: '@smoke' }, async ({ systemUsersPage, userFormPage, userFactory, employee }) => {
    const username = uniqueUsername('qaauto');

    await systemUsersPage.goto();
    await systemUsersPage.clickAdd();
    await userFormPage.fill({
      role: 'ESS',
      employee: { hint: employee.firstName.slice(0, 2), firstName: employee.firstName, lastName: employee.lastName },
      status: 'Enabled',
      username,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });

    const request = await test.step('Save and return to the list', () => userFormPage.saveAndReturnToList('POST', MESSAGES.saved));
    expect(request.postDataJSON()).toMatchObject({ username, status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber });
    await userFactory.trackUsername(username);

    await systemUsersPage.waitForTable();
    await systemUsersPage.filterByUsername(username);
    const row = systemUsersPage.rowByUsername(username);
    await expect(row).toHaveCount(1);
    await expect(systemUsersPage.cell(row, 'role')).toHaveText('ESS');
    await expect(systemUsersPage.cell(row, 'status')).toHaveText('Enabled');
  });

  test('TC-ADM-UI-024 Edit an existing user\'s role', async ({ systemUsersPage, userFormPage, userFactory, usersApi }) => {
    const user = await userFactory.create({ role: 'ESS', prefix: 'qaedit' });

    await systemUsersPage.goto();
    await systemUsersPage.filterByUsername(user.username);
    await systemUsersPage.openEdit(user.username);
    await userFormPage.waitForEditLoaded(user.username);
    await userFormPage.role.choose('Admin');
    const put = await userFormPage.saveAndReturnToList('PUT', MESSAGES.updated);
    expect(put.postDataJSON()).toMatchObject({ userRoleId: ROLE.Admin });

    await systemUsersPage.waitForTable();
    await systemUsersPage.filterByUsername(user.username);
    await expect(systemUsersPage.cell(systemUsersPage.rowByUsername(user.username), 'role')).toHaveText('Admin');
    const persisted = (await (await usersApi.get(user.id)).json()).data as SystemUser;
    expect(persisted.userRole.id).toBe(ROLE.Admin);
  });

  test('TC-ADM-UI-025 Edit User form hides password fields until Change Password is enabled', async ({ userFormPage, userFactory }) => {
    const user = await userFactory.create({ prefix: 'qaedit' });

    await userFormPage.gotoEdit(user.id, user.username);
    await expect(userFormPage.heading).toHaveText('Edit User');
    await expect(userFormPage.changePassword.root).toBeVisible();
    await expect(userFormPage.password.root).toHaveCount(0);
    await expect(userFormPage.confirmPassword.root).toHaveCount(0);

    await userFormPage.enableChangePassword();
    await expect(userFormPage.password.input).toBeVisible();
    await expect(userFormPage.confirmPassword.input).toBeVisible();
  });

  test('TC-ADM-UI-026 Password policy is enforced when changing an existing user\'s password', async ({ userFormPage, userFactory, page }) => {
    const user = await userFactory.create({ prefix: 'qaedit' });

    await userFormPage.gotoEdit(user.id, user.username);
    await userFormPage.enableChangePassword();
    await userFormPage.password.fillAndBlur('abc');
    await userFormPage.password.expectError(MESSAGES.passwordMin);

    const updates = new RequestRecorder(page, /\/api\/v2\/admin\/users\/\d+$/);
    await userFormPage.saveButton.click();
    await userFormPage.password.expectError(MESSAGES.passwordMin);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.saveSystemUser}/${user.id}$`));
    expect(updates.requests.filter((r) => r.method() === 'PUT'), 'weak password must not be saved').toEqual([]);
  });

  test('TC-ADM-UI-027 Disable a user account through the UI', async ({ systemUsersPage, userFormPage, userFactory }) => {
    const user = await userFactory.create({ enabled: true, prefix: 'qadis' });

    await userFormPage.gotoEdit(user.id, user.username);
    await userFormPage.status.choose('Disabled');
    const put = await userFormPage.saveAndReturnToList('PUT', MESSAGES.updated);
    expect(put.postDataJSON()).toMatchObject({ status: false });

    await systemUsersPage.waitForTable();
    await systemUsersPage.filterByUsername(user.username);
    await expect(systemUsersPage.cell(systemUsersPage.rowByUsername(user.username), 'status')).toHaveText('Disabled');
  });

  test('TC-ADM-UI-028 A disabled user cannot authenticate (end to end)', { tag: '@security' }, async ({ userFactory, freshSession }) => {
    const user = await userFactory.create({ enabled: false, prefix: 'qadis' });

    const { page, loginPage, shell } = await freshSession();
    await loginPage.goto();
    await loginPage.login(user.username, user.password);

    await expect(loginPage.errorBanner).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`));
    await expect(shell.userDropdownName).toHaveCount(0);
  });

  test('TC-ADM-UI-029 Re-enabling a disabled user restores the ability to authenticate', async ({ userFormPage, userFactory, freshSession }) => {
    const user = await userFactory.create({ enabled: false, prefix: 'qadis' });

    await userFormPage.gotoEdit(user.id, user.username);
    await userFormPage.status.choose('Enabled');
    const put = await userFormPage.saveAndReturnToList('PUT', MESSAGES.updated);
    expect(put.postDataJSON()).toMatchObject({ status: true });

    const { page, shell } = await freshSession({ username: user.username, password: user.password });
    await expect(page).toHaveURL(new RegExp(`${ROUTES.dashboard}$`));
    await shell.expectAuthenticated();
  });

  test('TC-ADM-UI-030 Delete a system user with confirmation', async ({ systemUsersPage, userFactory, usersApi }) => {
    const user = await userFactory.create({ prefix: 'qadel' });

    // Filtering to the fixture makes the counter deterministic on the shared demo (D-10).
    await systemUsersPage.goto();
    await systemUsersPage.filterByUsername(user.username);
    expect(await systemUsersPage.recordsFoundCount()).toBe(1);

    await systemUsersPage.openDelete(user.username);
    await expect(systemUsersPage.dialog.title).toHaveText('Are you Sure?');
    await systemUsersPage.dialog.confirm();

    await systemUsersPage.toast.expectSuccess(MESSAGES.deleted);
    await expect(systemUsersPage.dialog.root).toBeHidden();
    await expect(systemUsersPage.rowByUsername(user.username)).toHaveCount(0);
    await expect(systemUsersPage.recordsFound).toHaveText(/^(\(0\) Records Found|No Records Found)$/);
    expect((await usersApi.get(user.id)).status()).toBe(404);
    userFactory.untrack(user.id);
  });

  test('TC-ADM-UI-031 Cancelling the delete confirmation preserves the user', async ({ systemUsersPage, userFactory, usersApi }) => {
    const user = await userFactory.create({ prefix: 'qadel' });

    await systemUsersPage.goto();
    await systemUsersPage.filterByUsername(user.username);
    const before = await systemUsersPage.recordsFoundCount();

    await systemUsersPage.openDelete(user.username);
    await systemUsersPage.dialog.cancel();

    await expect(systemUsersPage.dialog.root).toBeHidden();
    await expect(systemUsersPage.rowByUsername(user.username)).toHaveCount(1);
    expect(await systemUsersPage.recordsFoundCount()).toBe(before);
    expect((await usersApi.get(user.id)).status()).toBe(200);
  });

  test('TC-ADM-UI-035 Admin cannot delete their own active account', { tag: '@security' }, async ({ userFactory, freshSession, usersApi }) => {
    // Executed with a DISPOSABLE Admin so a permissive build cannot break the shared
    // demo's real Admin account (exploration §7 deliberately excludes deleting it).
    const selfAdmin = await userFactory.create({ role: 'Admin', prefix: 'qaself' });
    const { page } = await freshSession({ username: selfAdmin.username, password: selfAdmin.password });

    const list = new SystemUsersPage(page);
    await list.goto();
    await list.filterByUsername(selfAdmin.username);
    const ownRow = list.rowByUsername(selfAdmin.username);
    await expect(ownRow).toHaveCount(1);

    // HEAL-005: the old version branched on whether a confirm dialog appeared. The build
    // blocks the action with an immediate error toast instead (no dialog), so the test now
    // asserts that outcome directly and unconditionally.
    const deletes = new RequestRecorder(page, /\/api\/v2\/admin\/users$/);
    await list.deleteButton(ownRow).click();

    await list.toast.expectError(MESSAGES.cannotBeDeleted);
    await expect(list.dialog.root).toHaveCount(0);
    expect(deletes.requests.filter((r) => r.method() === 'DELETE'), 'no delete may be sent').toEqual([]);
    expect((await usersApi.get(selfAdmin.id)).status(), 'own account must survive the delete attempt').toBe(200);
  });
});
