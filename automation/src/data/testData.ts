/**
 * Test data. The demo is shared and publicly credentialled (exploration D-10):
 * never assert absolute counts or rely on records this suite did not create.
 * Every fixture name is unique per run/worker so parallel runs cannot collide.
 */
let seq = 0;

export function uniqueUsername(prefix = 'qaauto'): string {
  seq += 1;
  const stamp = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${prefix}${stamp}${rnd}${seq}`.slice(0, 40);
}

/** A 5-character username (exact minimum length) that is overwhelmingly likely to be unused. */
export function uniqueFiveCharUsername(): string {
  return `q${Math.random().toString(36).slice(2, 6).padEnd(4, 'x')}`;
}

/** Satisfies the observed policy: >= 7 chars, >= 1 digit, >= 1 lower-case (exploration §2.3). */
export const VALID_PASSWORD = 'qaProbe1';

export const MESSAGES = {
  required: 'Required',
  invalidCredentials: 'Invalid credentials',
  accountDisabled: 'Account disabled',
  invalid: 'Invalid',
  usernameMin: 'Should be at least 5 characters',
  alreadyExists: 'Already exists',
  passwordMin: 'Should have at least 7 characters',
  passwordNeedsNumber: 'Your password must contain minimum 1 number',
  passwordNeedsLower: 'Your password must contain minimum 1 lower-case letter',
  passwordsDoNotMatch: 'Passwords do not match',
  noRecords: 'No Records Found',
  saved: 'Successfully Saved',
  updated: 'Successfully Updated',
  deleted: 'Successfully Deleted',
  cannotBeDeleted: 'Cannot be deleted',
  sessionExpired: 'Session expired',
  resetLinkSent: 'Reset Password link sent successfully',
} as const;

/** Known product defects referenced by expected-to-fail tests. */
export const KNOWN_DEFECTS = {
  disabledAccountDisclosure: 'BUG-01 / exploration D-02 — "Account disabled" discloses account state',
  confirmPasswordMessage: 'BUG-02 / exploration D-03 — empty Confirm Password says "Passwords do not match"',
  errorStatusType: 'BUG-03 / exploration D-05 — error.status is string in 404/422, integer in 401',
  createReturns200: 'exploration D-04 — POST /admin/users returns 200 instead of 201',
  usernameNotTrimmed:
    'BUG-06 — POST /admin/users stores leading/trailing whitespace in userName instead of trimming it',
  resetExistingUser504:
    'BUG-04 (healing-log HEAL-001) — reset for an EXISTING username returns 504 after ~60 s; unknown username returns 302 in ~300 ms',
} as const;
