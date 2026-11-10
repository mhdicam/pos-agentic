# Orbis v2 prototype — redesign and functional QA record
Status: draft (for review, not signed off)
Date: 2026-11-10
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff

Records the redesign of [`posverse_phase_2_2o_delivery_operations.html`](../references/posverse_phase_2_2o_delivery_operations.html)
into the project root (`index.html`, `css/`, `js/`, `tests/`, `CONTRACT.md`) and the browser QA of both. **Prototype evidence only**: it is a client-side
simulation, not server authorization, RLS, an installed PWA or a payment integration. It does not close any open
decision in [`rd-11-open-decisions.md`](../requirements/rd-11-open-decisions.md) and does not count toward the
109 UX acceptance cases (spec, not execution).

## What changed
| Area | 2.2O baseline | v2 |
|---|---|---|
| Structure | 13 inline scripts patching each other | One layer: core, domain (pure), screens; no CDN, works from `file://` |
| Mutations | Direct writes, partial updates possible | `Orbis.tx` atomic with rollback and same-transaction audit |
| Output safety | HTML built from raw user text | Every dynamic string escaped; XSS probe clean |
| Refund | Three overlapping paths | One path, cumulative per-line allocation, no self-approval |
| COD | Two parallel settlement paths | One path; no payment row until a reviewer verifies cash |
| Offline POS | Static numbers only; checkout succeeded offline as if online | Outbox with idempotent replay, conflicts, TTL, revoke; cash only; no loyalty/promo offline (RD03-12) |
| Support grant | Recorded, never enforced | Expiry enforced; support reads tenant 360 only while a grant is active |
| Suspended tenant | POS and storefront still sold | `orders.place` refuses on every channel |
| Customer role | Saw the owner dashboard | No sidebar routes; store and tracking only; tracking needs id + last 4 phone digits |

## Test evidence (exact)
- Domain tests: `node tests/run.js` → **172 passed, 0 failed, 172 total** (final run before this doc).
- Browser QA by headless Chromium (playwright-core), run by a separate agent against the **pre-fix** build:
  12 roles, 68 role×route pairs, 136 visits, 0 broken routes, 0 console errors, 0 network requests; flows (a)–(i) passed with state evidence;
  XSS probe clean; reload persistence and Reset demo passed. Defects D1–D7 found (below).
- Browser re-check after fixes by me, same Chromium: 12 roles, 67 role×route pairs at 390px with **0 horizontal overflow** and 0 page errors;
  POS member + promo fields keep typed values and focus; POS search keeps focus while typing.
- Baseline QA of the original (separate agent): 133 role×route pairs, 585 button clicks, 0 crashes; 11 defects (4 major, 7 minor).

## Defects found in v2 and their state
| ID | Sev | Defect | State |
|---|---|---|---|
| D1 | major | 60/68 routes overflowed horizontally at 390px | Fixed; re-verified 0/67 |
| D2 | major | POS member/promo input lost text because the page re-rendered on change | Fixed; re-verified in browser |
| D3 | major | Fleet sync as platform admin always CONFLICT (FORBIDDEN) | Fixed (replay runs under the device register identity; permission checks now read the in-flight transaction session); regression test added; re-verified in browser: clicking Sinkron as platform gave outbox SYNCED, 1 order, k1 stock 40→39, role restored, no page errors |
| D4 | minor | 36px primary buttons at 390px with a mouse pointer | Fixed; re-measured at 390px with a mouse pointer on catalog, POS and members: all primary buttons 40px, header selects 40px, header buttons 40px and 45px (below the 44px touch target only under a mouse pointer; `pointer:coarse` gives 44px) |
| D5 | minor | Fully refunded order stays ACCEPTED/REFUNDED | Open — needs a decision on the order status after a full refund |
| D6 | minor | Seed timestamps make the seed non-deterministic | Open — not user visible |
| D7 | minor | COD payment row created at placement | Fixed; regression test added |

## Not verified
Not exercised in the browser run: file uploads, CSV import, held carts, split and QRIS payment, delivery fail/retry/return,
partial-quantity refund (only 1 of 1 tested), plan/status requests, 36-case delivery acceptance.
The 36 role journeys and 109 acceptance cases are **not** executed by this work. Dark-mode screenshots were taken but not visually reviewed by me.

## Run
Open `index.html` in a browser; tests: `node tests/run.js`. Module ownership and data contract: `CONTRACT.md` (repo root).
