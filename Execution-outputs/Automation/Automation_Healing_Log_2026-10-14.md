# Automation Healing Log — 2026-10-14

| Field | Value |
|---|---|
| **Run** | AUTH module, 36 test cases (+ login setup), 3 workers — 13:41:35–13:44:02 UTC |
| **Outcome** | 37/37 as expected · unexpected failures: 0 · flaky: 0 |
| **Companion report** | `Execution-outputs/Automation/Automation_Execution_Summary_2026-10-14.html` |

## Triage of every failure in the run

| Test | Failure | Classification | Action |
|---|---|---|---|
| TC-AUTH-UI-007 | `Error: Timed out 10000ms waiting for expect(locator).toHaveText(expected)` | Product defect (known, `test.fail`) | Not healed — BUG-01 |
| TC-AUTH-UI-020 | `Error: reset POST must redirect to the confirmation screen` | Product defect (known, `test.fail`) | Not healed — BUG-02 |
| TC-AUTH-UI-022 | `Error: status must not reveal that the username exists` | Product defect (known, `test.fail`) | Not healed — BUG-03 |

No test failed unexpectedly and none was flaky, so **no heal was applied** in this run.

## Changes to the suite in this run (not heals)

- **Failure evidence (CLAUDE.md §4).** Added `src/utils/evidence.ts` with the automatic `bugEvidence` fixture: specs mark where a defect would show (`watch(locator, label)`); on failure the area is outlined and labelled in red and the screenshot is attached. `recordExchange()` attaches each API test's request and response with cookies, tokens and passwords redacted. Registered in `TC-AUTH-UI-007`, `020`, `022` and the six `TC-AUTH-API-*` tests; `ForgotPasswordPage` gained `serverErrorHeading`.
- **Run 1 discarded (13:36:01–13:39:37 UTC).** Results were identical (37/37 as expected), but on review the red label covered the "504 Gateway Time-out" heading in the TC-AUTH-UI-020/022 screenshots. The label now moves below an element at the top of the page. The full suite was re-run so the report comes from one consistent run (run 2).

## Methodology

Failures are classified before any code changes: product defect (never healed; `test.fail` with a bug reference), specification mismatch (assertion kept), environment issue (re-run in isolation) or test defect (narrowest fix, verified with `--repeat-each=3`). See `automation/healing-log.md` and `Execution-outputs/Automation/Automation_Healing_Log_2026-10-13.md` for earlier heals.
