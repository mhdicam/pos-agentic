# ADR-0011 Recipe-Driven Ingredient Stock and Menu Cost (HPP)
Status: proposed (draft for review, not signed off)
Date: 2026-11-11

## Context
Review mining shows recipe/ingredient stock is a top differentiator for F&B tenants: Loyverse users complain stock cannot be tracked through modifiers, and Moka sells recipes as a paid add-on ([global review mining](../research/2026-11-11-global-pos-review-mining.md), [Indonesian review mining](../research/2026-11-11-id-pos-review-mining.md)). Today a sale moves stock only for the sold variant ([ADR-0004](0004-sku-inventory-ledger.md)) and COGS uses the variant's static cost snapshot ([ADR-0005](0005-financial-pricing-snapshot.md)). Gap G1 in [RD-17](../requirements/rd-17-tenant-review-gaps.md).

## Decision
- Ingredients are ordinary SKUs flagged as `ingredient` with a base unit (g, ml, pcs); they stay inside the ADR-0004 ledger (same movements, same idempotency on type + reference + SKU).
- A recipe is attached to a variant and optionally to a modifier option: a list of `{ingredientSku, qty}` in integer base units.
- Placing an order writes, in the same transaction, one `RECIPE_USE` movement per ingredient per order (summing variant and modifier usage); refunds with restock write the reverse movement once per refund.
- Menu cost (HPP) per line = Σ ingredient qty × ingredient moving-average cost, rounded to integer IDR, snapshotted on the order line (extends ADR-0005). Moving-average cost updates on purchase receipt.
- Stock policy when an ingredient is short is a tenant setting (block sale vs. allow negative with a flagged movement), pending D-RD17-c.

## Rationale
Reusing the existing ledger keeps one stock authority and the existing opname/transfer/report flows working for ingredients without a second inventory model. Snapshotting HPP keeps historical margin stable when ingredient prices change. Rejected: deducting ingredients asynchronously after sale (breaks atomicity and offline replay guarantees in ADR-0003); a separate ingredient ledger (two stock authorities).

## Consequences
- Sales path cost grows with recipe size; offline replay must include recipe resolution at sale time (snapshot the recipe version on the order).
- Reports gain real COGS; RD15-07 "Estimasi" label can be lifted for tenants with complete recipes.
- New schema: `recipes`, `recipe_lines`, ingredient unit and moving-average cost fields; migrations and RLS policies as per ADR-0002.
- Requires EARS RD17-06..09 frozen, Finance sign-off on moving-average costing, and D-RD17-c decided before implementation.

## Sources
- [RD-17 tenant review gaps](../requirements/rd-17-tenant-review-gaps.md), [tenant gap analysis](../research/2026-11-11-tenant-gap-analysis.md)
- [ADR-0004 inventory ledger](0004-sku-inventory-ledger.md), [ADR-0005 pricing snapshot](0005-financial-pricing-snapshot.md), [ADR-0003 offline POS](0003-offline-pos-p0.md)
- Review state: Engineering Lead + Product + Finance: **PENDING**. This ADR is a proposal, not an accepted architectural decision.
