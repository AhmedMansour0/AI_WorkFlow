import { test, expect } from '../../../src/fixtures/test';
import { ROLE } from '../../../src/config/env';
import { KNOWN_DEFECTS, MESSAGES } from '../../../src/data/testData';
import type { SystemUser } from '../../../src/api/AdminUsersApi';

/**
 * GET /api/v2/admin/users — envelope, schema, paging, sorting, filtering, errors.
 * The total is volatile on the shared demo (D-10): assertions are relational
 * (page size vs total, disjoint pages, reverse order), never absolute.
 */
test.describe('User Management API — read', { tag: ['@adm', '@api'] }, () => {
  test('TC-ADM-API-001 List users returns the standard response envelope', { tag: '@smoke' }, async ({ usersApi }) => {
    const res = await usersApi.list({ limit: 50, offset: 0, sortField: 'u.userName', sortOrder: 'ASC' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['data', 'meta', 'rels']);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('TC-ADM-API-002 User object conforms to the documented schema', async ({ usersApi }) => {
    const res = await usersApi.list({ limit: 1 });
    expect(res.status()).toBe(200);
    const [user] = (await res.json()).data as SystemUser[];

    expect(user).toEqual({
      id: expect.any(Number),
      userName: expect.any(String),
      deleted: expect.any(Boolean),
      status: expect.any(Boolean),
      employee: expect.objectContaining({
        empNumber: expect.any(Number),
        firstName: expect.any(String),
        middleName: expect.any(String),
        lastName: expect.any(String),
      }),
      userRole: { id: expect.any(Number), name: expect.any(String), displayName: expect.any(String) },
    });
    expect(user.employee).toHaveProperty('terminationId');
    expect(Object.keys(user.employee).sort()).toEqual(
      ['empNumber', 'employeeId', 'firstName', 'lastName', 'middleName', 'terminationId'].sort(),
    );
  });

  test('TC-ADM-API-003 meta.total reports the unfiltered total independent of page size', async ({ usersApi }) => {
    const page = await (await usersApi.list({ limit: 2, offset: 0 })).json();
    const full = await (await usersApi.list({ limit: 1, offset: 0 })).json();

    expect(page.data).toHaveLength(2);
    expect(page.meta.total).toBeGreaterThanOrEqual(3);
    // Same unfiltered total regardless of the page size requested (tolerates concurrent demo writes).
    expect(Math.abs(page.meta.total - full.meta.total)).toBeLessThanOrEqual(2);
  });

  test('TC-ADM-API-004 limit and offset paginate correctly without overlap', async ({ usersApi }) => {
    const sort = { sortField: 'u.userName', sortOrder: 'ASC' } as const;
    const first = await usersApi.list({ limit: 2, offset: 0, ...sort });
    const second = await usersApi.list({ limit: 2, offset: 2, ...sort });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);

    const a = ((await first.json()).data as SystemUser[]).map((u) => u.id);
    const b = ((await second.json()).data as SystemUser[]).map((u) => u.id);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });

  test('TC-ADM-API-005 sortField and sortOrder order the result set', async ({ usersApi }) => {
    // HEAL-003: the server sorts with MySQL collation (punctuation such as "' OR..." sorts
    // first), which no JS collator reproduces. The check is now collation-agnostic: fetch
    // the WHOLE set in one page each way and require DESC to be the exact reverse of ASC.
    // toPass() re-fetches the pair if a concurrent write on the shared demo (D-10) changed
    // the set between the two calls; the order assertion itself is never relaxed.
    await expect(async () => {
      const total = (await (await usersApi.list({ limit: 1 })).json()).meta.total as number;
      const limit = total + 25;
      const ascRes = await usersApi.list({ limit, sortField: 'u.userName', sortOrder: 'ASC' });
      const descRes = await usersApi.list({ limit, sortField: 'u.userName', sortOrder: 'DESC' });
      expect(ascRes.status()).toBe(200);
      expect(descRes.status()).toBe(200);

      const asc = await ascRes.json();
      const desc = await descRes.json();
      expect(asc.meta.total, 'set changed between calls').toBe(desc.meta.total);
      expect(asc.data, 'whole set must fit the requested page').toHaveLength(asc.meta.total);

      const ascNames = (asc.data as SystemUser[]).map((u) => u.userName);
      const descNames = (desc.data as SystemUser[]).map((u) => u.userName);
      expect(descNames).toEqual([...ascNames].reverse());
    }).toPass({ intervals: [1_000, 2_000, 4_000], timeout: 30_000 });
  });

  test('TC-ADM-API-006 Invalid sortField is rejected naming the offending key', async ({ usersApi }) => {
    const res = await usersApi.list({ limit: 50, offset: 0, sortField: 'bogusField', sortOrder: 'ASC' });
    expect(res.status()).toBe(422);
    expect(await res.json()).toEqual({
      error: { status: '422', message: 'Invalid Parameter', data: { invalidParamKeys: ['sortField'] } },
    });
  });

  test('TC-ADM-API-007 Filter the user list by username query parameter', async ({ usersApi }) => {
    const res = await usersApi.list({ limit: 50, offset: 0, username: 'Admin' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const users = body.data as SystemUser[];

    expect(users.length).toBeGreaterThan(0);
    for (const u of users) expect(u.userName.toLowerCase()).toBe('admin');
    expect(body.meta.total).toBe(users.length);
  });

  test('TC-ADM-API-008 Filter the user list by userRoleId', async ({ usersApi }) => {
    const res = await usersApi.list({ limit: 50, offset: 0, userRoleId: ROLE.Admin });
    expect(res.status()).toBe(200);
    const users = (await res.json()).data as SystemUser[];

    expect(users.length).toBeGreaterThan(0);
    for (const u of users) expect(u.userRole).toMatchObject({ id: ROLE.Admin, name: 'Admin' });
  });

  test('TC-ADM-API-009 Filter the user list by status', async ({ usersApi, userFactory }) => {
    const disabled = await userFactory.create({ enabled: false, prefix: 'qadis' });

    const res = await usersApi.list({ limit: 50, offset: 0, status: false });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const users = body.data as SystemUser[];

    expect(users.length).toBeGreaterThan(0);
    for (const u of users) expect(u.status).toBe(false);
    expect(users.map((u) => u.id)).toContain(disabled.id);
  });

  test('TC-ADM-API-010 offset beyond the total returns an empty page (boundary)', async ({ usersApi }) => {
    const res = await usersApi.list({ limit: 50, offset: 99_999 });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBeGreaterThan(0);
  });

  for (const limit of [-1, 0]) {
    test(`TC-ADM-API-011 Invalid limit value (${limit}) is rejected or safely defaulted (boundary)`, async ({ usersApi }) => {
      const res = await usersApi.list({ limit, offset: 0 });
      expect(res.status(), 'no HTTP 500').toBeLessThan(500);
      expect([200, 422]).toContain(res.status());
      const body = await res.json();
      if (res.status() === 422) {
        expect(body.error.data.invalidParamKeys).toContain('limit');
      } else {
        expect(Array.isArray(body.data)).toBe(true);
      }
    });
  }

  test('TC-ADM-API-012 Retrieve a single user by id', async ({ usersApi }) => {
    const res = await usersApi.get(1);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(false);
    expect(body.data).toMatchObject({ id: 1, userName: expect.any(String) });
    expect(body.meta).toEqual([]);
    expect(body.rels).toEqual([]);
  });

  test('TC-ADM-API-013 Retrieving a non-existent user id returns a structured error', async ({ usersApi }) => {
    const res = await usersApi.get(999_999);
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: { status: '404', message: 'Record Not Found' } });
  });

  test(
    'TC-ADM-API-014 error.status data type is consistent across error responses',
    { annotation: { type: 'issue', description: KNOWN_DEFECTS.errorStatusType } },
    async ({ usersApi, anonUsersApi }) => {
      test.fail(true, KNOWN_DEFECTS.errorStatusType);
      const notFound = await (await usersApi.get(999_999)).json();
      const invalid = await (await usersApi.list({ sortField: 'bogusField' })).json();
      const unauth = await (await anonUsersApi.list({ limit: 1 })).json();
      expect(unauth.error.message).toBe(MESSAGES.sessionExpired);

      const types = new Set([typeof notFound.error.status, typeof invalid.error.status, typeof unauth.error.status]);
      expect([...types], 'error.status must use a single JSON type').toHaveLength(1);
    },
  );

  test('TC-ADM-API-035 Employee autocomplete endpoint backs the Employee Name field', async ({ employeesApi }) => {
    const res = await employeesApi.search('Pe');
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.data.length).toBeGreaterThan(0);
    for (const e of body.data) {
      expect(e).toEqual(expect.objectContaining({
        empNumber: expect.any(Number),
        firstName: expect.any(String),
        middleName: expect.any(String),
        lastName: expect.any(String),
      }));
      expect(e).toHaveProperty('employeeId');
    }
    expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length);
  });
});
