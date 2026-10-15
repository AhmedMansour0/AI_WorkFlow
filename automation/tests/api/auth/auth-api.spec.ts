import { test, expect } from '../../../src/fixtures/test';
import { API, ENV, ROUTES } from '../../../src/config/env';
import { MESSAGES } from '../../../src/data/testData';
import type { FreshSession } from '../../../src/fixtures/test';
import { recordExchange } from '../../../src/utils/evidence';

/**
 * The login endpoint is a server-rendered form POST (always 302 — exploration
 * §1.3), not a JSON API. A valid `_token` is bound to the session cookie, so it is
 * harvested from a rendered login page and replayed with that page's cookie jar.
 */
async function postLogin(session: FreshSession, username: string, password: string) {
  await session.loginPage.goto();
  const token = await session.loginPage.readCsrfToken();
  const response = await session.page.request.post(ROUTES.validate, {
    form: { _token: token, username, password },
    maxRedirects: 0,
  });
  // Evidence for the report's Request & Response viewer (password and token redacted).
  await recordExchange(test.info(), {
    method: 'POST', url: ENV.baseURL + ROUTES.validate,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'orangehrm=…' },
    body: `_token=${token}&username=${username}&password=${password}`,
  }, response);
  return response;
}
const recordGet = (url: string, res: import('@playwright/test').APIResponse, cookie = true) =>
  recordExchange(test.info(), { method: 'GET', url: ENV.baseURL + url, headers: cookie ? { Cookie: 'orangehrm=…' } : {} }, res);

const SESSION_EXPIRED = { error: { status: 401, message: MESSAGES.sessionExpired } };

test.describe('Authentication — API', { tag: ['@auth', '@api'] }, () => {
  test('TC-AUTH-API-001 Login endpoint authenticates and issues a session cookie', async ({ freshSession }) => {
    const session = await freshSession();
    const response = await postLogin(session, ENV.adminUsername, ENV.adminPassword);

    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    expect(location).not.toMatch(/\/auth\/login$/);

    const setCookies = response.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
    expect(setCookies.some((h) => h.value.startsWith('orangehrm='))).toBe(true);

    const probe = await session.page.request.get(API.users, { params: { limit: 1 } });
    await recordGet(API.users + '?limit=1', probe);
    expect(probe.status()).toBe(200);
  });

  test('TC-AUTH-API-002 Login endpoint refuses invalid credentials', async ({ freshSession }) => {
    const session = await freshSession();
    const response = await postLogin(session, ENV.adminUsername, 'wrongpass123');

    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toMatch(new RegExp(`${ROUTES.login}$`));
    const probe = await session.page.request.get(API.users, { params: { limit: 1 } });
    await recordGet(API.users + '?limit=1', probe);
    expect(probe.status()).toBe(401);
  });

  test('TC-AUTH-API-003 Login endpoint always responds 302 regardless of outcome', async ({ freshSession }) => {
    const valid = await postLogin(await freshSession(), ENV.adminUsername, ENV.adminPassword);
    const invalid = await postLogin(await freshSession(), ENV.adminUsername, 'wrongpass123');

    expect(valid.status()).toBe(302);
    expect(invalid.status()).toBe(302);
    expect(valid.headers()['location']).not.toBe(invalid.headers()['location']);
  });

  test('TC-AUTH-API-004 Protected API endpoint refuses an unauthenticated request', async ({ anonUsersApi }) => {
    const response = await anonUsersApi.list({ limit: 2, offset: 0 });
    await recordGet(API.users + '?limit=2&offset=0', response, false);

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual(SESSION_EXPIRED);
  });

  test('TC-AUTH-API-005 API refuses a request bearing a post-logout cookie', async ({ freshSession, playwright }) => {
    const { context, shell } = await freshSession({ username: ENV.adminUsername, password: ENV.adminPassword });
    const oldCookie = (await context.cookies()).find((c) => c.name === 'orangehrm');
    expect(oldCookie?.value).toBeTruthy();

    await shell.logout();

    const replay = await playwright.request.newContext({
      baseURL: ENV.baseURL,
      extraHTTPHeaders: { Cookie: `orangehrm=${oldCookie!.value}` },
    });
    try {
      const response = await replay.get(API.users, { params: { limit: 1 } });
      await recordGet(API.users + '?limit=1', response);
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual(SESSION_EXPIRED);
    } finally {
      await replay.dispose();
    }
  });

  test('TC-AUTH-API-006 Authenticated web client calls succeed with the session cookie', async ({ freshSession }) => {
    const { page } = await freshSession({ username: ENV.adminUsername, password: ENV.adminPassword });

    const result = await page.evaluate(async (url) => {
      const res = await fetch(`${url}?limit=2`, { credentials: 'include' });
      return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.json() };
    }, API.users);
    await recordExchange(test.info(), { method: 'GET', url: ENV.baseURL + API.users + '?limit=2', headers: { Cookie: 'orangehrm=… (credentials: include)' } },
      { status: result.status, headers: result.headers, body: JSON.stringify(result.body, null, 2) });

    expect(result.status).toBe(200);
    expect(Object.keys(result.body).sort()).toEqual(['data', 'meta', 'rels']);
    expect(Array.isArray(result.body.data)).toBe(true);
  });
});
