# Acceptance criteria — EARS standard
Status: operating standard (draft for review, not signed off)
Date: 2026-11-10

Every behavior change is written first as **EARS** (Easy Approach to Requirements Syntax) acceptance
criteria, then mapped to a test ID in [`EARS_TEST_TRACEABILITY.csv`](../handoff/EARS_TEST_TRACEABILITY.csv).

## Patterns
| Pattern | Template |
|---|---|
| Ubiquitous | The system shall `<response>` |
| Event-driven | When `<trigger>`, the system shall `<response>` |
| State-driven | While `<state>`, the system shall `<response>` |
| Optional | Where `<feature is present>`, the system shall `<response>` |
| Unwanted | If `<condition>`, then the system shall `<response>` |

## Rules
- One criterion per line, ID prefix per document (`PRD-NN`, `FRD-NN`, `RDnn-NN`), pattern named in parentheses.
- Every criterion ends with `Tests:` listing `P23-*` IDs, or `NONE (gap)` — never an invented test ID.
- No unmeasurable adjectives ("fast", "secure", "reliable") without a number, unit or observable outcome.
- Money is integer IDR; time limits name the clock (server time, device time) and the unit.
- A criterion inferred from prototype/localStorage behavior is a target, not evidence.

## Example
> **RD03-xx** (Unwanted): If a sync batch with an already-accepted `Idempotency-Key` is replayed, then the system shall return the original result and shall not create a second stock, cash or loyalty movement. Tests: NONE (gap)
