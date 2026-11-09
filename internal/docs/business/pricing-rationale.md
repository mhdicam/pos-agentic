# Pricing rationale
Status: draft (for review, not signed off)
Date: 2026-11-10

No price list is approved. This doc records the **pricing mechanics** proposed in the
[Master PRD §19](../references/MASTER_PRD_SaaS_POS_MultiTenant_Delivery_AI_v1.4.5.md) so engineering builds
entitlements, not hard-coded plan checks. Amounts and tiers require Product/Finance sign-off.

## Principles
- **Entitlements, not plan names.** Packages and add-ons are expressed as entitlements; code never branches on `plan == 'pro'`.
- **Fixed tier before metering** (OD-10). Seat/usage metering is deferred until usage counters are proven accurate.
- **SaaS billing is separate from merchant settlement.** The platform bills subscriptions; order payments settle from PSP to merchant (OD-12). The platform does not hold merchant funds.
- **Downgrade never deletes.** Excess outlets/records are frozen for new creation; operational records are kept (PRD §17 rule 10, AC-S01).
- **AI credits are explicit.** AI usage is a separate credit ledger with an owner-editable hard cap; official WhatsApp channel charges are passed through independently (OD-17, OD-26).
- **Unofficial WhatsApp is never sold as "free unlimited"** (OD-26); any connector charge covers infrastructure/support only.

## Open items
Tier names, IDR amounts, trial length, grace/suspension durations and add-on catalog — tracked in
[`rd-11-open-decisions.md`](../requirements/rd-11-open-decisions.md) and [`rd-08-platform-billing.md`](../requirements/rd-08-platform-billing.md).
