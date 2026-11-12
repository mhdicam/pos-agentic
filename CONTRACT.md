# Orbis v2 prototype — module contract

Single-layer rewrite of `internal/docs/references/posverse_phase_2_2o_delivery_operations.html` (13 patched layers).
Plain classic scripts, no runtime build, no CDN: opens from `file://`. Client-side simulation only, **not** a security boundary.
Styling: Tailwind v4 + shadcn/ui look, light mode only. Edit `css/src/app.css`, then `npm run css` to regenerate the committed `css/app.css` (see `internal/docs/design-system/design-system.md`). No inline `style=`/`<style>` in screens.

## Rules every module follows
1. **Domain** code (`js/domain/<x>.js`) is pure: no DOM. It exports to `Orbis.domain.<x>`. Every mutation runs inside `Orbis.tx(function(d, ctx){...}, {audit:{action,entity,entityId}})`; throw `Orbis.Err(code, 'pesan Indonesia')` to abort and roll back. Permission check first: `Orbis.require('perm')`.
2. **Tenant** always comes from `d.session.tenant` (never an argument). Read tenant rows with `Orbis.mine(d, 'collection')`; every row you create has `tenant`.
3. **Money** is integer IDR (`Orbis.int`). Stock only via `Orbis.domain.inventory.move/onHand/available` (immutable movements, idempotent on type+ref+sku).
4. **Time** via `Orbis.clock.now()` (ms). **Ids** via `Orbis.nextId(d, 'PREFIX', pad)`. No `Math.random`, no `Date.now` in domain.
5. **Screens** (`js/screens/<x>.js`): `Orbis.screens['route'] = function(d, ctx){ return htmlString }` — pure render. **Every dynamic string goes through `Orbis.esc`**. Clicks are `<button data-act="name" data-args='[...]'>` via `Orbis.btn(label, act, args, opts)`; handlers live in `Orbis.actions.name = function(...args)`, call domain code, and use `Orbis.attempt` implicitly (app.js wraps every action; throw `Orbis.Err` to show a toast). After a successful tx the app re-renders automatically (`Orbis.emit`).
6. Modals: `Orbis.modal(title, bodyHtml, footHtml)`, read with `Orbis.formData()`, close with `Orbis.closeModal()`. Inline forms: `Orbis.readForm('#selector')`.
7. UI kit: `Orbis.pageHead, card, stat, table, field, tabs, chip, btn, empty, idr, fmtTime, icon`. Chips always show text. Tabs state: keep in `Orbis.ui = Orbis.ui || {}` namespaced by your module (UI-only state, never business data).
8. Permissions: use keys already in `js/core/rbac.js` `Orbis.PERMS`; if you need a new one add it at the top of your domain file: `Orbis.PERMS['x.y'] = ['owner', ...]`. **Do not edit files outside the ones you own.** Navigation routes are fixed in `Orbis.NAV` (rbac.js); implement only the routes you own.
9. Tests: `tests/<module>.test.js` using `test(name, fn(O, T))`, helpers `T.eq, T.ok, T.throws(fn, 'CODE'), T.as(role, tenant)`. Each test starts from a fresh seed. Cover happy path **and** negative paths (forbidden role, wrong tenant, double-submit/idempotency, invalid transition, boundary values). Run: `node tests/run.js`. Also `node --check` every file you write.
10. Indonesian UI copy, concise. Mobile first (390px), tables use `class="tbl stack"` on mobile.

## Extension points (tenant back-office, 2026-11-10)
Feature batches must not edit each other's files. They plug in through these core hooks instead:
- `Orbis.hooks.skuPrice(d, sku, outlet)` → int|undefined (per-outlet price) · `Orbis.hooks.resolveModifiers(d, sku, ids)` → `[{id,name,price}]` (throws on invalid pick) — **B2 catalog**
- `Orbis.hooks.charges(d, {base, outlet, channel, method})` → `{tax, service, rounding, taxLabel}` · `Orbis.hooks.tenderEnabled(d, type)` → bool — **B6 settings**
- `Orbis.hooks.can(perm, role, d)` → true|false|undefined (tenant role overrides; undefined = default `Orbis.PERMS`) — **B4 team**
- RD-17: `Orbis.hooks.lineCost(d, sku, mods, outlet)` → int|undefined (recipe HPP per unit) · `Orbis.hooks.autoDiscount(d, {items, subtotal, channel, outlet, promoCode})` → `{amount, promoId, name}`|null · `Orbis.hooks.afterPlace.push(fn(d, order))` · `Orbis.hooks.afterReverse.push(fn(d, order, {ref, kind:'cancel'|'refund'|'void', ratio?, lines?}))` — all run inside the caller's tx.
- `Orbis.seedHooks.push(fn(db, T0))` adds base seed rows for your own collections. `Orbis.batch(fn)` = many tx, one persist/render, all-or-nothing.
- Order lines may carry `modifiers:[{id,name,price}]`, `basePrice`, `note`; same sku with different modifiers = separate lines. Orders carry `rounding`, `taxLabel`.
- `d.session.outlet` is switchable in the topbar (`setOutlet`): POS, shift, stock and outlet filters must read it, never assume `o1`.
- `Orbis.demoHistory()` (js/core/demo.js) builds ~30 days of history through real domain calls; extend it by adding your own seedHooks/demo steps in your own files, not by editing demo.js.

## Shared shapes (data contract; extend only your own collections)
```
order   {id,tenant,outlet,channel:'pos'|'store',customer:{name,phone},items:[{skuId,name,qty,price,cost}],
         subtotal,discount,tax,service,deliveryFee,total,method:'pickup'|'delivery'|'dine',address,
         status:'PLACED'|'ACCEPTED'|'PREPARING'|'READY'|'COMPLETED'|'CANCELLED'|'RETURNED',
         paymentStatus:'PENDING'|'PAID'|'COLLECTION_PENDING'|'COD_COLLECTED'|'PARTIALLY_REFUNDED'|'REFUNDED',
         shiftId,memberId,promoId,createdAt,history:[{at,by,from,to}]}
payment {id,tenant,orderId,type:'cash'|'transfer'|'qris'|'cod',amount,at,shiftId}   // d.payments, one row per tender leg
shift   {id,tenant,outlet,register,openedBy,openedAt,openingCash,closedAt,countedCash,variance,note}
delivery{id,tenant,orderId,outlet,status:<12 states>,courierId,version,attempts,offerExpiresAt,dueAt,history[],pod,proofReview,codAmount,returnCondition}
remittance{id,tenant,deliveryId,orderId,courierId,amount,status:'SUBMITTED'|'VERIFIED'|'DISPUTED',reason}
```
Delivery states: READY_FOR_ASSIGNMENT, ASSIGNED, ACCEPTED, PICKED_UP, IN_TRANSIT, ARRIVED, DELIVERED, DELIVERY_FAILED, RETRY_PENDING, RETURN_TO_STORE, RETURNED, CANCELLED.

## Cross-module API (owner provides; others call defensively: `Orbis.domain.x && Orbis.domain.x.fn`)
| Fn | Owner | Meaning |
|---|---|---|
| `orders.place(d, spec)` spec={channel,items:[{skuId,qty}],method,customer,address,payment:{type,legs?},promoCode?,memberId?,redeemPoints?} → order | sales | Server-side pricing from sku price, stock moves via inventory, promo/member via growth, payment rules (cash/transfer→PAID; cod→COLLECTION_PENDING), flat deliveryFee 10000 for delivery. Used by POS and storefront. |
| `orders.get(d,id)`, `orders.advance(id)`, `orders.cancel(id,reason)` | sales | status machine; READY + method delivery calls `delivery.enqueue(d, order)` |
| `orders.complete(d, orderId)`, `orders.markReturned(d, orderId)`, `orders.setPaymentStatus(d, orderId, status)` | sales | called by delivery/cod (inside caller's tx) |
| `delivery.enqueue(d, order)` | delivery | creates delivery in READY_FOR_ASSIGNMENT (idempotent per orderId) |
| `promos.quote(d,{code,subtotal,channel})` → `{promoId,discount}` or throws | growth | validates window, quota, min purchase, cap; does NOT consume |
| `promos.consume(d, promoId, orderId)` | growth | increments use once per orderId |
| `members.preview(d,{memberId,subtotal,redeemPoints})` → `{redeemValue,earn}`; `members.commit(d,{memberId,orderId,total,redeemPoints})`; `members.reverse(d,orderId,ratio)` | growth | points earn/redeem ledger, idempotent per orderId |
| `inventory.*` | core (done) | see js/domain/inventory.js |

## Files and owners
| Owner | Domain | Screens (routes) | Tests |
|---|---|---|---|
| sales | `domain/sales.js` (orders, shifts, payments, refunds, returns) | `screens/pos.js` (pos), `screens/orders.js` (orders), `screens/refunds.js` (refunds) | `tests/sales.test.js` |
| growth | `domain/growth.js` (promos, members, storefront publish) | `screens/members.js` (members), `screens/promos.js` (promos), `screens/storefront.js` (storefront builder), `screens/store.js` (store, track — customer view) | `tests/growth.test.js` |
| delivery | `domain/delivery.js` (dispatch, courier, POD, COD, remittance) | `screens/dispatch.js` (dispatch), `screens/cod.js` (cod), `screens/courier.js` (courier, courier-cash) | `tests/delivery.test.js` |
| finance | `domain/finance.js` (catalog, PO/receiving, expenses, approval matrix, reports) | `screens/catalog.js` (catalog), `screens/procurement.js` (procurement), `screens/expenses.js` (expenses), `screens/reports.js` (reports) | `tests/finance.test.js` |
| platform | `domain/platform.js` (tenants, plans, billing, maker/checker, grants with enforced expiry, offline POS fleet + real outbox queue) | `screens/platform.js` (platform, platform-tenants, platform-billing, platform-approvals, platform-fleet, platform-audit) | `tests/platform.test.js` |
| comms | `domain/comms.js` (inbox, handoff, AI credits/budget, KB, CRM, integrations) | `screens/inbox.js` (inbox), `screens/ai.js` (ai), `screens/integrations.js` (integrations) | `tests/comms.test.js` |
| core (lead) | `domain/inventory.js`, `domain/tenant.js` (owner profile/hours, plan usage + plan request, audit read, onboarding, demo sales) | `screens/landing.js` (public landing, `Orbis.landing`), `screens/overview.js` (overview), `screens/team.js` (team), `screens/owner.js` (settings, billing, audit) | `tests/core.test.js`, `tests/tenant.test.js` |
