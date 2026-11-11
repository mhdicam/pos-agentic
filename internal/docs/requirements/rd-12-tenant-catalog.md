# RD-12 Tenant catalog (variants, modifiers, outlet price) — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-10
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Benchmark: [`tenant back-office benchmark`](../references/2026-11-10-tenant-backoffice-benchmark.md) §1 Products / catalog, rows: "Variants with own price + SKU" (M1, J4), "Modifiers/add-ons as reusable sets" (M1, J4, I1), "Modifier rules: required/optional groups" (T1, T3), "Per-outlet price and stock" (V3, I2, T1); top-10 item 1. Prototype contract: `CONTRACT.md` (Extension points: `Orbis.hooks.skuPrice`, `Orbis.hooks.resolveModifiers`).

Traceability: Screen `catalog` (tabs Produk / Kategori / Modifier, product detail) and `pos` (variant/modifier picker) → Domain `Orbis.domain.catalog` (`js/domain/x-catalog.js`) → Data `categories`, `modifierGroups`, `skuOutlets`, `products.modifierGroupIds`, `products.archived`, `skus.archived` → Permission `catalog.write` (owner, brand, manager), sale `pos.sell` → Tests `tests/x-catalog.test.js`.

## Acceptance Criteria (EARS)
- **RD12-01** (Ubiquitous): The system shall keep a per-tenant category list that can be created, renamed (propagated to products), reordered and archived, with names unique per tenant. Tests: `x-catalog: categories CRUD, rename propagates, reorder, archive`, `x-catalog: category duplicate name rejected`
- **RD12-02** (Ubiquitous): The system shall let a product hold 1..n variants (SKU), each with its own SKU code, price, HPP and barcode, and allow archiving a variant while at least one other variant stays active. Tests: `x-catalog: archive variant blocks sale, last active variant protected`
- **RD12-03** (Unwanted): If an archived product or archived variant is ordered, then the system shall reject the quote. Tests: `x-catalog: archive variant blocks sale, last active variant protected`, `x-catalog: archive product unpublishes and blocks sale; unarchive restores`
- **RD12-04** (Ubiquitous): The system shall store modifier groups `{name, required, min, max, options[{name, price}]}` with integer IDR prices and `0 <= min <= max <= options`, and attach groups to products. Tests: `x-catalog: modifier group validation`, `x-catalog: resolveModifiers prices options into the quote`
- **RD12-05** (Unwanted): If a modifier pick contains an option not attached to the product, misses a required group, or exceeds a group's max, then the system shall fail with `MODIFIER_INVALID`. Tests: `x-catalog: modifier picks rejected (foreign, required missing, over max, duplicate)`
- **RD12-06** (Optional): Where an outlet price override exists for a variant, the system shall price that variant at the override for orders at that outlet. Tests: `x-catalog: outlet price override applies only at that outlet`
- **RD12-07** (Unwanted): If a variant is marked "tidak dijual" at the session outlet, then the system shall fail the quote with `NOT_AVAILABLE`. Tests: `x-catalog: unavailable at outlet blocks the sale`
- **RD12-08** (Unwanted): If a role without `catalog.write` or a session of another tenant changes categories, variants, modifier groups or outlet prices, then the system shall reject the change (`FORBIDDEN` / `NOT_FOUND`). Tests: `x-catalog: forbidden roles and wrong tenant`
- **RD12-09** (Event): When a catalog change commits, the system shall write one audit event in the same transaction. Tests: `x-catalog: categories CRUD, rename propagates, reorder, archive`
- **RD12-10** (Event): When a cashier taps a product with several variants or modifier groups in POS, the system shall open a picker (variant, modifiers, note) and add a cart line priced with modifiers. Tests: NONE (UI only, manual check in `pos`)

## Known gaps (requests to other owners)
- `orders.quote` calls `resolveModifiers` only when a line carries modifiers, so a line with no picks bypasses required groups (POS picker enforces it client-side). Request to sales: call the hook for every line of a product with groups.
- `carts.hold` keeps only `{skuId, qty}`; POS refuses to hold a cart with modifiers/notes until sales stores them.
- `storefront.products` does not check `sku.archived` / outlet availability; archived products are unpublished on archive, archived variants still show. Request to growth.
- Large variant of Kopi Susu Awan is added by the demo hook, not the base seed (base seed SKU counts are asserted by core tests).

## Open review gates
Browser-local prototype only; server authorization, concurrency and production integrations are not covered.
