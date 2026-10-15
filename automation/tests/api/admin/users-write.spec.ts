import { test, expect } from '../../../src/fixtures/test';
import { ROLE } from '../../../src/config/env';
import { KNOWN_DEFECTS, VALID_PASSWORD, uniqueUsername } from '../../../src/data/testData';
import type { SystemUser } from '../../../src/api/AdminUsersApi';

/**
 * POST / PUT / DELETE /api/v2/admin/users (exploration §3.6, FR-API-10).
 * Every user created here is registered with userFactory and removed at teardown.
 */
test.describe('User Management API — write', { tag: ['@adm', '@api'] }, () => {
  test('TC-ADM-API-015 Create a user via POST (positive)', { tag: '@smoke' }, async ({ usersApi, userFactory, employee }) => {
    const username = uniqueUsername('qaapi');
    const res = await usersApi.create({ username, password: VALID_PASSWORD, status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber });
    expect(res.ok(), await res.text()).toBe(true);
    const body = await res.json();
    userFactory.track(body.data.id);

    expect(body.data).toMatchObject({
      id: expect.any(Number),
      userName: username,
      status: true,
      deleted: false,
      userRole: { id: ROLE.ESS, name: 'ESS' },
      employee: { empNumber: employee.empNumber },
    });
    expect(body.meta).toEqual([]);
    expect(body.rels).toEqual([]);
  });

  test(
    'TC-ADM-API-016 Create returns the conventional HTTP 201 status for a new resource',
    { annotation: { type: 'issue', description: KNOWN_DEFECTS.createReturns200 } },
    async ({ usersApi, userFactory, employee }) => {
      test.fail(true, KNOWN_DEFECTS.createReturns200);
      const res = await usersApi.create({ username: uniqueUsername('qaapi'), password: VALID_PASSWORD, status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber });
      if (res.ok()) userFactory.track((await res.json()).data.id);
      expect(res.status()).toBe(201);
    },
  );

  test('TC-ADM-API-017 API rejects a duplicate username (server-side uniqueness)', async ({ usersApi, userFactory, employee }) => {
    const existing = await userFactory.create({ prefix: 'qaapi' });
    const res = await usersApi.create({ username: existing.username, password: VALID_PASSWORD, status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber });

    expect(res.status()).toBe(422);
    expect(await res.json()).toEqual({
      error: { status: '422', message: 'Invalid Parameter', data: { invalidParamKeys: ['username'] } },
    });
  });

  test('TC-ADM-API-018 API enforces the password policy independently of the UI', async ({ usersApi, employee }) => {
    const username = uniqueUsername('qaapi');
    const res = await usersApi.create({ username, password: 'abc', status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber });

    expect(res.status()).toBe(422);
    expect((await res.json()).error.data.invalidParamKeys).toContain('password');
    expect(await usersApi.findByUsername(username)).toBeUndefined();
  });

  test('TC-ADM-API-019 Create with missing mandatory fields names every offending key', async ({ usersApi }) => {
    const res = await usersApi.create({ username: uniqueUsername('qaapi') });

    expect(res.status()).toBe(422);
    const keys = (await res.json()).error.data.invalidParamKeys as string[];
    expect(keys).toEqual(expect.arrayContaining(['password', 'userRoleId', 'empNumber', 'status']));
  });

  test('TC-ADM-API-020 Create with an invalid userRoleId is rejected (negative)', async ({ usersApi, employee }) => {
    const username = uniqueUsername('qaapi');
    const res = await usersApi.create({ username, password: VALID_PASSWORD, status: true, userRoleId: 9999, empNumber: employee.empNumber });

    expect(res.status()).toBe(422);
    expect((await res.json()).error.data.invalidParamKeys).toContain('userRoleId');
    expect(await usersApi.findByUsername(username)).toBeUndefined();
  });

  test('TC-ADM-API-021 Create with an invalid empNumber is rejected (negative)', async ({ usersApi }) => {
    const username = uniqueUsername('qaapi');
    const res = await usersApi.create({ username, password: VALID_PASSWORD, status: true, userRoleId: ROLE.ESS, empNumber: 999_999 });

    expect(res.status()).toBe(422);
    expect((await res.json()).error.data.invalidParamKeys).toContain('empNumber');
    expect(await usersApi.findByUsername(username)).toBeUndefined();
  });

  test('TC-ADM-API-022 Disable a user via PUT', async ({ usersApi, userFactory }) => {
    const user = await userFactory.create({ enabled: true, prefix: 'qaapi' });
    const res = await usersApi.update(user.id, {
      username: user.username, password: '', status: false, userRoleId: user.roleId, empNumber: user.empNumber, changePassword: false,
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).data.status).toBe(false);
    const persisted = (await (await usersApi.get(user.id)).json()).data as SystemUser;
    expect(persisted.status).toBe(false);
  });

  test('TC-ADM-API-023 Update rejects a payload omitting the password key', async ({ usersApi, userFactory }) => {
    const user = await userFactory.create({ prefix: 'qaapi' });
    const res = await usersApi.update(user.id, {
      username: user.username, status: true, userRoleId: user.roleId, empNumber: user.empNumber, changePassword: false,
    });

    expect(res.status()).toBe(422);
    expect((await res.json()).error.data.invalidParamKeys).toContain('password');
  });

  test('TC-ADM-API-024 Update rejects a null password where an empty string is accepted', async ({ usersApi, userFactory }) => {
    const user = await userFactory.create({ prefix: 'qaapi' });
    const base = { username: user.username, status: true, userRoleId: user.roleId, empNumber: user.empNumber, changePassword: false };

    const withNull = await usersApi.update(user.id, { ...base, password: null });
    expect(withNull.status()).toBe(422);
    expect((await withNull.json()).error.data.invalidParamKeys).toContain('password');

    const withEmpty = await usersApi.update(user.id, { ...base, password: '' });
    expect(withEmpty.status()).toBe(200);
  });

  test('TC-ADM-API-025 Update a user\'s role via PUT', async ({ usersApi, userFactory }) => {
    const user = await userFactory.create({ role: 'ESS', prefix: 'qaapi' });
    const res = await usersApi.update(user.id, {
      username: user.username, password: '', status: true, userRoleId: ROLE.Admin, empNumber: user.empNumber, changePassword: false,
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).data.userRole).toMatchObject({ id: ROLE.Admin, name: 'Admin' });
    const persisted = (await (await usersApi.get(user.id)).json()).data as SystemUser;
    expect(persisted.userRole.id).toBe(ROLE.Admin);
  });

  test('TC-ADM-API-026 Update of a non-existent user id is rejected', async ({ usersApi, employee }) => {
    const username = uniqueUsername('qaapi');
    const res = await usersApi.update(999_999, {
      username, password: '', status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber, changePassword: false,
    });

    expect(res.status(), 'no HTTP 500').toBeLessThan(500);
    expect([404, 422]).toContain(res.status());
    expect((await res.json()).error).toBeDefined();
    expect(await usersApi.findByUsername(username), 'no record may be created').toBeUndefined();
  });

  test('TC-ADM-API-027 Delete a user via the collection endpoint', async ({ usersApi, userFactory }) => {
    const user = await userFactory.create({ prefix: 'qadel' });
    const res = await usersApi.delete([user.id]);

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ data: [String(user.id)], meta: [], rels: [] });
    userFactory.untrack(user.id);
  });

  test('TC-ADM-API-028 A deleted user is no longer retrievable', async ({ usersApi, userFactory }) => {
    const user = await userFactory.create({ prefix: 'qadel' });
    expect((await usersApi.delete([user.id])).status()).toBe(200);
    userFactory.untrack(user.id);

    const single = await usersApi.get(user.id);
    expect(single.status()).toBe(404);
    expect((await single.json()).error.message).toBe('Record Not Found');

    const list = (await (await usersApi.list({ limit: 50, username: user.username })).json()).data as SystemUser[];
    expect(list.map((u) => u.userName)).not.toContain(user.username);
  });

  test('TC-ADM-API-029 Delete of a non-existent id is handled gracefully (negative)', async ({ usersApi, userFactory }) => {
    const sentinel = await userFactory.create({ prefix: 'qasent' });
    const res = await usersApi.delete([999_999]);

    expect(res.status(), 'no HTTP 500').toBeLessThan(500);
    expect([404, 422]).toContain(res.status());
    expect((await res.json()).error).toBeDefined();
    expect((await usersApi.get(sentinel.id)).status(), 'no unrelated record may be removed').toBe(200);
  });

  test('TC-ADM-API-030 Delete accepts multiple ids in a single request (boundary)', async ({ usersApi, userFactory }) => {
    const [a, b] = await userFactory.createMany(2, { prefix: 'qadel' });
    const res = await usersApi.delete([a.id, b.id]);

    expect(res.status()).toBe(200);
    expect(((await res.json()).data as string[]).sort()).toEqual([String(a.id), String(b.id)].sort());
    userFactory.untrack(a.id);
    userFactory.untrack(b.id);

    for (const u of [a, b]) expect(await usersApi.findByUsername(u.username)).toBeUndefined();
  });

  test(
    'TC-ADM-API-043 Leading and trailing spaces in usernames are trimmed',
    { annotation: { type: 'issue', description: KNOWN_DEFECTS.usernameNotTrimmed } },
    async ({ usersApi, userFactory, employee, freshSession }) => {
    test.fail(true, KNOWN_DEFECTS.usernameNotTrimmed);
    const core = uniqueUsername('qatrim');
    const res = await usersApi.create({ username: ` ${core} `, password: VALID_PASSWORD, status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber });
    if (res.ok()) userFactory.track((await res.json()).data.id);

    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).data.userName, 'API should trim whitespace on creation').toBe(core);

    const { shell } = await freshSession({ username: core, password: VALID_PASSWORD });
    await shell.expectAuthenticated();
    },
  );
});
