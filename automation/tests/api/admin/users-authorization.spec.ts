import { test, expect } from '../../../src/fixtures/test';
import { API, ROLE } from '../../../src/config/env';
import { MESSAGES, VALID_PASSWORD, uniqueUsername, uniqueFiveCharUsername } from '../../../src/data/testData';
import type { SystemUser } from '../../../src/api/AdminUsersApi';

const SESSION_EXPIRED = { error: { status: 401, message: MESSAGES.sessionExpired } };

test.describe('User Management API — username validation', { tag: ['@adm', '@api'] }, () => {
  test('TC-ADM-API-031 Username validation endpoint reports an existing username as invalid', async ({ usersApi }) => {
    const res = await usersApi.validateUsername('Admin');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ data: { valid: false }, meta: [], rels: [] });
  });

  test('TC-ADM-API-032 Username validation endpoint reports an unused username as valid', async ({ usersApi }) => {
    const unused = uniqueUsername('qaprobe');
    expect(await usersApi.findByUsername(unused)).toBeUndefined();

    const res = await usersApi.validateUsername(unused);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ data: { valid: true }, meta: [], rels: [] });
  });
});

test.describe('User Management API — authorization', { tag: ['@adm', '@api', '@security'] }, () => {
  test('TC-ADM-API-033 Username validation endpoint refuses unauthenticated callers', async ({ anonUsersApi }) => {
    const res = await anonUsersApi.validateUsername('Admin');
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual(SESSION_EXPIRED);
  });

  test('TC-ADM-API-034 Every Admin user-management endpoint refuses unauthenticated access', async ({ anonUsersApi, usersApi, userFactory, employee }) => {
    // Write probes target a disposable fixture, never the shared Admin record.
    const target = await userFactory.create({ prefix: 'qaauthz' });
    const probeName = uniqueFiveCharUsername();

    const calls = {
      'GET /admin/users': anonUsersApi.list({ limit: 1 }),
      'GET /admin/users/{id}': anonUsersApi.get(target.id),
      'POST /admin/users': anonUsersApi.create({ username: probeName, password: VALID_PASSWORD, status: true, userRoleId: ROLE.ESS, empNumber: employee.empNumber }),
      'PUT /admin/users/{id}': anonUsersApi.update(target.id, { username: target.username, password: '', status: false, userRoleId: ROLE.Admin, empNumber: target.empNumber, changePassword: false }),
      'DELETE /admin/users': anonUsersApi.delete([target.id]),
    };

    for (const [name, pending] of Object.entries(calls)) {
      const res = await pending;
      expect(res.status(), name).toBe(401);
      expect(await res.json(), name).toEqual(SESSION_EXPIRED);
    }

    const after = (await (await usersApi.get(target.id)).json()).data as SystemUser;
    expect(after, 'record must be neither modified nor deleted').toMatchObject({ status: true, userRole: { id: ROLE.ESS } });
    const leaked = await usersApi.findByUsername(probeName);
    if (leaked) userFactory.track(leaked.id); // defensive cleanup if the product let it through
    expect(leaked, 'no record may be created').toBeUndefined();
  });

  test('TC-ADM-API-042 Downgraded user loses Admin API access on the next call', async ({ usersApi, userFactory, freshSession }) => {
    // Admin B is a disposable Admin; Admin A is the suite's shared Admin session.
    const adminB = await userFactory.create({ role: 'Admin', prefix: 'qaroleb' });
    const { page } = await freshSession({ username: adminB.username, password: adminB.password });

    const before = await page.request.get(API.users, { params: { limit: 1 } });
    expect(before.status(), 'Admin B starts with access').toBe(200);

    const downgrade = await usersApi.update(adminB.id, {
      username: adminB.username, password: '', status: true, userRoleId: ROLE.ESS, empNumber: adminB.empNumber, changePassword: false,
    });
    expect(downgrade.status()).toBe(200);

    const after = await page.request.get(API.users, { params: { limit: 1 } });
    expect(after.status(), 'role change must take effect mid-session').toBe(403);
  });
});
