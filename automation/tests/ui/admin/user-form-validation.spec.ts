import { test, expect } from '../../../src/fixtures/test';
import { ROUTES } from '../../../src/config/env';
import { KNOWN_DEFECTS, MESSAGES, VALID_PASSWORD, uniqueFiveCharUsername, uniqueUsername } from '../../../src/data/testData';
import { RequestRecorder } from '../../../src/utils/network';

/**
 * FR-ADM-1 / FR-ADM-2 — Add User form validation.
 *
 * D-09: validation is debounced. Positive message checks use retrying
 * `toHaveText`; "no message" checks go through FormField.expectNoError(), which
 * waits for the message to stay unchanged for a quiet window before asserting.
 * Username checks additionally wait for the async uniqueness probe to answer.
 */
const CREATE_CALL = /\/api\/v2\/admin\/users$/;

test.describe('User Management — Add User form validation', { tag: ['@adm', '@ui'] }, () => {
  test.beforeEach(async ({ userFormPage }) => {
    await userFormPage.gotoAdd();
  });

  test('TC-ADM-UI-010 Add User form renders all required fields', { tag: '@smoke' }, async ({ userFormPage, page, systemUsersPage }) => {
    // Reach the form the way a user does: list > Add.
    await systemUsersPage.goto();
    await systemUsersPage.clickAdd();
    await expect(userFormPage.heading).toHaveText('Add User');

    for (const field of [userFormPage.role, userFormPage.status]) await expect(field.selectText).toBeVisible();
    for (const field of [userFormPage.employee, userFormPage.username, userFormPage.password, userFormPage.confirmPassword]) {
      await expect(field.input).toBeVisible();
    }
    await expect(userFormPage.employee.input).toHaveAttribute('placeholder', 'Type for hints...');
    await expect(userFormPage.password.input).toHaveAttribute('type', 'password');
    await expect(userFormPage.confirmPassword.input).toHaveAttribute('type', 'password');
    await expect(userFormPage.cancelButton).toBeVisible();
    await expect(userFormPage.saveButton).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.saveSystemUser}$`));
  });

  test('TC-ADM-UI-012 Submitting an empty Add User form surfaces required-field validation', async ({ userFormPage, page }) => {
    const creates = new RequestRecorder(page, CREATE_CALL);
    await userFormPage.saveButton.click();

    for (const field of [userFormPage.role, userFormPage.employee, userFormPage.status, userFormPage.username, userFormPage.password]) {
      await field.expectError(MESSAGES.required);
    }
    await expect(page).toHaveURL(new RegExp(`${ROUTES.saveSystemUser}$`));
    expect(creates.urls, 'the user must not be created').toEqual([]);
  });

  test(
    'TC-ADM-UI-013 Confirm Password shows the correct message on an empty form',
    { annotation: { type: 'issue', description: KNOWN_DEFECTS.confirmPasswordMessage } },
    async ({ userFormPage }) => {
      test.fail(true, KNOWN_DEFECTS.confirmPasswordMessage);
      await userFormPage.saveButton.click();
      await expect(userFormPage.username.error).toHaveText(MESSAGES.required); // form validated
      await expect(userFormPage.confirmPassword.error).toHaveText(MESSAGES.required, { timeout: 5_000 });
    },
  );

  test('TC-ADM-UI-014 Username shorter than the minimum is rejected (boundary, below)', async ({ userFormPage }) => {
    await userFormPage.username.fillAndBlur('abcd');
    await userFormPage.username.expectError(MESSAGES.usernameMin);
  });

  test('TC-ADM-UI-015 Username at exactly the minimum length is accepted (boundary, at)', async ({ userFormPage }) => {
    const username = uniqueFiveCharUsername();
    expect(username).toHaveLength(5);
    await userFormPage.enterUsername(username);
    await userFormPage.username.expectNoError();
  });

  test('TC-ADM-UI-016 Duplicate username is rejected', async ({ userFormPage, userFactory, employee, page }) => {
    const existing = await userFactory.create({ prefix: 'qadup' });

    await userFormPage.fill({
      role: 'ESS',
      employee: { hint: employee.firstName.slice(0, 2), firstName: employee.firstName, lastName: employee.lastName },
      status: 'Enabled',
      username: existing.username,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });
    await userFormPage.username.expectError(MESSAGES.alreadyExists);

    const creates = new RequestRecorder(page, CREATE_CALL);
    await userFormPage.saveButton.click();
    await userFormPage.username.expectError(MESSAGES.alreadyExists);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.saveSystemUser}$`));
    expect(creates.urls, 'a duplicate must not be saved').toEqual([]);
  });

  test('TC-ADM-UI-017 Password below the minimum length is rejected (boundary, below)', async ({ userFormPage }) => {
    await userFormPage.password.fillAndBlur('abcde1');
    await userFormPage.password.expectError(MESSAGES.passwordMin);
  });

  test('TC-ADM-UI-018 Password at exactly the minimum length is accepted (boundary, at)', async ({ userFormPage }) => {
    await userFormPage.password.fillAndBlur('abcdef1');
    await userFormPage.password.expectNoError();
  });

  test('TC-ADM-UI-019 Password without a digit is rejected', async ({ userFormPage }) => {
    await userFormPage.password.fillAndBlur('abcdefgh');
    await userFormPage.password.expectError(MESSAGES.passwordNeedsNumber);
  });

  test('TC-ADM-UI-020 Password without a lower-case letter is rejected', async ({ userFormPage }) => {
    await userFormPage.password.fillAndBlur('ABCDEFG1');
    await userFormPage.password.expectError(MESSAGES.passwordNeedsLower);
  });

  test('TC-ADM-UI-021 All-numeric password is rejected (boundary)', async ({ userFormPage }) => {
    await userFormPage.password.fillAndBlur('1234567');
    await userFormPage.password.expectError(MESSAGES.passwordNeedsLower);
  });

  test('TC-ADM-UI-022 Mismatched Confirm Password is rejected', async ({ userFormPage, page }) => {
    await userFormPage.password.fillAndBlur(VALID_PASSWORD);
    await userFormPage.confirmPassword.fillAndBlur('qaProbe2');
    await userFormPage.confirmPassword.expectError(MESSAGES.passwordsDoNotMatch);

    const creates = new RequestRecorder(page, CREATE_CALL);
    await userFormPage.saveButton.click();
    await userFormPage.confirmPassword.expectError(MESSAGES.passwordsDoNotMatch);
    expect(creates.urls, 'the user must not be saved').toEqual([]);
  });

  test('TC-ADM-UI-023 Cancel on the Add User form discards the entry', async ({ userFormPage, usersApi, userFactory, employee }) => {
    const username = uniqueUsername('qacancel');
    await userFormPage.fill({
      role: 'ESS',
      employee: { hint: employee.firstName.slice(0, 2), firstName: employee.firstName, lastName: employee.lastName },
      status: 'Enabled',
      username,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    });

    await userFormPage.cancel();

    const created = await usersApi.findByUsername(username);
    if (created) userFactory.track(created.id); // defensive cleanup if the product saved anyway
    expect(created, 'Cancel must not create a user').toBeUndefined();
  });
});
