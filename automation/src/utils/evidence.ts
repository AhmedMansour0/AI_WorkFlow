import type { APIResponse, Locator, Page, TestInfo } from '@playwright/test';

/**
 * Failure evidence required by CLAUDE.md §4: every failed UI test case gets a
 * screenshot with the bug area outlined and labelled in red.
 *
 * A test declares WHERE its defect would appear with `watch(locator, label)`.
 * Nothing happens while the test passes; if it fails (including an expected
 * `test.fail` known defect), the fixture outlines that element, adds the red
 * label, screenshots the page and attaches it as `bug-evidence`. With nothing
 * watched, the screen is labelled with the first line of the error instead.
 */
export class BugEvidence {
  private watched: { locator: Locator; label: string } | undefined;

  constructor(private readonly page: Page) {}

  watch(locator: Locator, label: string): void {
    this.watched = { locator, label };
  }

  /** Called by the fixture at teardown. */
  async captureIfFailed(testInfo: TestInfo): Promise<void> {
    if (testInfo.status !== 'failed' && testInfo.status !== 'timedOut') return;
    if (this.page.isClosed() || this.page.url() === 'about:blank') return;
    // A test can fail on a response status before the resulting page has rendered; let it finish.
    await this.page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
    const fallback = (testInfo.error?.message ?? 'Test failed').replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 140);
    const label = this.watched?.label ?? `Failure: ${fallback}`;
    const target = this.watched && (await this.watched.locator.count().catch(() => 0)) > 0 ? this.watched.locator.first() : undefined;

    const box = target ? await target.boundingBox().catch(() => null) : null;
    await this.page.evaluate(([b, text]) => {
      const tag = document.createElement('div');
      tag.textContent = text;
      Object.assign(tag.style, { position: 'fixed', zIndex: '2147483647', maxWidth: '900px', background: '#D03B3B', color: '#fff',
        font: '700 13px Segoe UI, Arial, sans-serif', padding: '6px 10px', borderRadius: '5px', boxShadow: '0 2px 6px rgba(0,0,0,.3)' });
      if (b) {
        const outline = document.createElement('div');
        Object.assign(outline.style, { position: 'fixed', zIndex: '2147483646', left: b.x - 5 + 'px', top: b.y - 5 + 'px',
          width: b.width + 10 + 'px', height: b.height + 10 + 'px', border: '3px solid #D03B3B', borderRadius: '6px', pointerEvents: 'none' });
        document.body.appendChild(outline);
        // Label above the element; if there is no room (element at the top), below it, so it never hides the defect.
        const top = b.y - 42 >= 8 ? b.y - 42 : b.y + b.height + 12;
        Object.assign(tag.style, { left: Math.max(8, b.x - 5) + 'px', top: top + 'px' });
      } else {
        Object.assign(tag.style, { left: '8px', top: '8px' });
      }
      document.body.appendChild(tag);
    }, [box, label] as const).catch(() => undefined);

    const png = await this.page.screenshot().catch(() => undefined);
    if (png) await testInfo.attach('bug-evidence', { body: png, contentType: 'image/png' });
  }
}

const SECRET_HEADERS = /^(cookie|set-cookie|authorization|x-api-key)$/i;
const redactBody = (body: string) =>
  body.replace(/(password|_token|token)=([^&]*)/gi, '$1=<redacted>').replace(/("password"\s*:\s*)"[^"]*"/gi, '$1"<redacted>"');

export interface ExchangeRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Attaches one HTTP request/response pair as `http-exchange` JSON so the execution
 * report can render its Request & Response viewer. Secrets are redacted here,
 * before anything is written to disk.
 */
export async function recordExchange(testInfo: TestInfo, req: ExchangeRequest, res: APIResponse | { status: number; headers: Record<string, string>; body: string }): Promise<void> {
  const isApi = typeof (res as APIResponse).status === 'function';
  const status = isApi ? (res as APIResponse).status() : (res as { status: number }).status;
  const headers = isApi ? (res as APIResponse).headers() : (res as { headers: Record<string, string> }).headers;
  let body = isApi ? await (res as APIResponse).text().catch(() => '') : (res as { body: string }).body;
  if (body.length > 1500) body = body.slice(0, 1500) + ' …[truncated]';
  const clean = (h: Record<string, string> = {}) =>
    Object.fromEntries(Object.entries(h).map(([k, v]) => [k, SECRET_HEADERS.test(k) ? '<redacted>' : v]));
  const exchange = {
    request: { method: req.method, url: req.url, headers: clean(req.headers), body: req.body ? redactBody(req.body) : '' },
    response: { status, headers: clean(headers), body: redactBody(body) },
  };
  await testInfo.attach('http-exchange', { body: JSON.stringify(exchange, null, 2), contentType: 'application/json' });
}
