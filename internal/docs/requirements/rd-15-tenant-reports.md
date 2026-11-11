# RD-15 Tenant reports (sales reports suite) — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-10
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Benchmark: [`tenant back-office benchmark`](../references/2026-11-10-tenant-backoffice-benchmark.md) §4 "Sales reports" rows (summary M7/S4; item/category/modifier M7/J7; payment method M7/J11; order type M7/J7; discount/void with authoriser S3/J8; refunds M7/J7; tax per name M7/S3; collected-by vs served-by M7; shift M8/J7/O3; outlet/date/channel filters + export M7/S4/O2), §"Empty report states" (S3) and recommendation 10. Builds on [`RD-09`](rd-09-finance-analytics.md) (RD09-03 estimated margin, RD09-04 one event set, RD09-09 scope). Prototype contract: `CONTRACT.md` (Extension points).

Traceability: Screen `reports` (`js/screens/x-reports.js`, replaces `Orbis.screens.reports`) → Domain `Orbis.domain.reports2` (`js/domain/x-reports.js`) → Data `orders`, `payments`, `refunds`, `shifts`, `promos`, `pointLedger`, `outlets`, `products`, `skus` (read-only) → Permission `report.read` → Tests `tests/x-reports.test.js` → Slice: tenant back-office batch 5.

## Canonical rules (prototype)
- **Filter** `{from, to, outlet, channel, staff}`: dates `YYYY-MM-DD`, inclusive; **day and hour boundaries are WIB (UTC+7)** for every report (the older `Orbis.domain.reports` uses UTC days and is not used by this screen). Presets: Hari ini, Kemarin, 7 hari, 30 hari, Bulan ini, custom.
- **Event sets:** sales = non-cancelled orders by `createdAt`; money = `payments` rows by `at` (refund legs are negative rows; COD appears only once finance-verified and a `cod` payment row exists); refunds = APPROVED refunds by `decidedAt`; voids = cancelled orders by cancel time.
- **Summary:** gross = Σsubtotal (line price incl. modifiers); net = gross − discounts − approved refunds; total billed = gross − discounts + tax + service + rounding + delivery fee; collected = Σpayment rows (net of refund legs). Comparison period = same length immediately before `from`.
- Discount split: member point redemption (from `pointLedger` EARN `redeemValue`) vs promo code (rest of `order.discount`).
- "Per staf" = order `createdBy` (collected-by). Served-by (waiter) is not captured yet.
- Gross profit is **Estimasi**: net sales − Σ(line qty × cost snapshot); ignores waste, restocked returns and operating costs.

## Acceptance Criteria (EARS)
- **RD15-01** (Ubiquitous): The system shall reconcile the per-payment-method net total with the summary "total diterima" and with the tenant payment ledger for the same filter. Tests: `RD15 reconcile: per-payment net = summary collected; Σpayments rows = payment ledger`
- **RD15-02** (Ubiquitous): The system shall make the per-outlet figures for every outlet sum to the all-outlet figures, and every breakdown (product, category, order type, staff, hour, day, discount, tax, refund) sum to the matching summary total. Tests: `RD15 reconcile: per-outlet partitions all outlets; every breakdown sums to summary`
- **RD15-03** (Event): When a refund is approved, the system shall subtract it from net sales and show its amount, reason, requester and approver; pending or rejected refunds shall not change net sales. Tests: `RD15 refunds reduce net; pending/rejected do not; approver shown`
- **RD15-04** (Ubiquitous): The system shall bucket report days and hours in WIB (UTC+7), so an order at 23:30 WIB belongs to that date and one at 00:30 WIB to the next. Tests: `RD15 WIB day boundaries: 23:30 WIB counts today, 00:30 WIB next day`
- **RD15-05** (Event): When the user picks a date preset or range, the system shall compare every summary metric with the previous period of equal length and reject a range whose start is after its end. Tests: `RD15 previous-period comparison and presets`
- **RD15-06** (Ubiquitous): The system shall report each shift with cashier, outlet, sales, net cash and variance. Tests: `RD15 shifts: sales and variance per shift; estimated margin`
- **RD15-07** (Ubiquitous): The system shall label gross profit and margin as "Estimasi" computed from line cost snapshots (RD09-03). Tests: `RD15 shifts: sales and variance per shift; estimated margin`
- **RD15-08** (State): While no sold line carries modifiers in the filter, the system shall show the modifier report empty state "Belum ada data modifier"; otherwise it shall aggregate from line `modifiers` snapshots. Tests: `RD15 modifiers: empty without modifier data, aggregated when lines carry modifiers`
- **RD15-09** (Unwanted): If the role lacks `report.read` (e.g. cashier), then the system shall reject the report with FORBIDDEN. Tests: `RD15 permission and scope: cashier FORBIDDEN, manager pinned to own outlet, other tenant sees nothing`
- **RD15-10** (Unwanted): If a report user lacks tenant or outlet scope, then the system shall exclude that data: another tenant's rows never appear, a foreign outlet id is NOT_FOUND, and an Outlet Manager is pinned to the session outlet (RD09-09). Tests: `RD15 permission and scope: cashier FORBIDDEN, manager pinned to own outlet, other tenant sees nothing`
- **RD15-11** (Ubiquitous): The system shall compute each report over ~660 demo orders within 50 ms, using id maps instead of nested scans. Tests: `RD15 performance: every report under 50ms on demo data`
- **RD15-12** (Event): When the user exports a report, the system shall download exactly the visible rows as CSV with formula-injection defence (`Orbis.domain.reports.csvCell`). Tests: NONE (UI; reuses `csvCell` tests in `tests/finance.test.js`) — gap

- **RD15-13** (Ubiquitous): Net sales shall subtract only the goods part of approved refunds (pro-rated by subtotal-minus-discount over total-minus-delivery) and shall ignore refunds of cancelled orders; the cash refunded stays visible as `refundsPaid`. Tests: `review fixes: report net uses goods part of refunds and ignores cancelled orders`
## Open review gates
Browser-local prototype only; server authorization, concurrency and production integrations are not covered. Gaps: served-by (waiter) attribution, per-device/terminal filter, Excel/ZIP export and scheduled email (O2), report retention window (M11), per-tenant timezone (fixed WIB), CSV export UI test.
