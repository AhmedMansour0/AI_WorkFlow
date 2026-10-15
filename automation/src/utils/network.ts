import type { Page, Request } from '@playwright/test';

/**
 * Records every request whose URL matches `pattern` from the moment it is created.
 * Used to prove a NEGATIVE — e.g. "no request is sent to /auth/validate" — which a
 * waitForRequest() cannot express.
 */
export class RequestRecorder {
  readonly requests: Request[] = [];
  private readonly listener = (r: Request) => {
    if (this.pattern.test(r.url())) this.requests.push(r);
  };

  constructor(private readonly page: Page, private readonly pattern: RegExp) {
    page.on('request', this.listener);
  }

  get urls(): string[] {
    return this.requests.map((r) => `${r.method()} ${r.url()}`);
  }

  stop(): void {
    this.page.off('request', this.listener);
  }
}

/** Records every HTTP response status >= 500 seen by the page. */
export class ServerErrorRecorder {
  readonly errors: string[] = [];

  constructor(page: Page) {
    page.on('response', (r) => {
      if (r.status() >= 500) this.errors.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    });
  }
}
