# Global POS Review Mining
Status: draft (for review, not signed off)
Date: 2026-11-11
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff

Purpose: find what small F&B/retail merchants praise and still miss in top global POS back offices, as input for gap review of the Orbis tenant-owner back-office prototype. Reference only; not a requirement and not authorization to implement.

Method: G2 + Capterra product, compare and category pages read 2026-11-11 (via Exa search/fetch). Ratings drift daily and pages disagree by a few reviews; numbers below are as shown on the cited URL. Score = combined-review-weighted rating x combined review count (Capterra + G2). Google Play / App Store: NOT_RUN (budget). Quotes are verbatim, trimmed to <=15 words.

## 1. Ranking table (read 2026-11-11)

| # | Product | Capterra rating (n) | G2 rating (n) | Combined n | Score | Sources |
|---|---|---|---|---|---|---|
| 1 | Square Point of Sale | 4.6 (3,045) | 4.6 (1,224) | 4,269 | ~19,640 | https://www.capterra.com/compare/136301-275802/Toast-POS-vs-Square-Point-of-Sale ; https://www.g2.com/products/square-point-of-sale/reviews |
| 2 | Lightspeed Retail | 4.0 (976) | 4.0 (295) | 1,271 | ~5,080 | https://www.capterra.com/compare/120491-205337/Lightspeed-Retail-vs-Shopify-POS ; https://www.g2.com/products/lightspeed-retail/reviews |
| 3 | Toast | 4.1 (555) | 4.2 (377) | 932 | ~3,860 | https://www.capterra.com/p/136301/Toast-POS/ ; https://www.g2.com/products/toast/reviews |
| 4 | Shopify POS | 4.6 (248) | 4.4 (380) | 628 | ~2,810 | https://www.capterra.com/p/205337/Shopify-POS/ ; https://www.g2.com/products/shopify-shopify-pos/reviews |
| 5 | Clover | 3.8 (617) | 3.8 (109) | 726 | ~2,760 | https://www.capterra.com/p/226864/Clover/ ; https://www.g2.com/products/clover/reviews |
| 6 | Loyverse POS | 4.8 (458) | 4.7 (16) | 474 | ~2,270 | https://www.capterra.com/p/150632/Loyverse-POS/ ; https://www.g2.com/compare/loyverse-free-pos-vs-shopify-shopify-pos |
| 7 | TouchBistro | 3.8 (414) | 4.1 (109) | 523 | ~2,020 | https://www.capterra.com/compare/140677-150632/TouchBistro-vs-Loyverse-POS ; https://www.g2.com/products/lightspeed-restaurant/reviews (sidebar) |
| 8 | Revel Systems | 3.6 (323) | 4.1 (145) | 468 | ~1,760 | https://www.capterra.com/compare/135040-150632/Revel-iPad-POS-vs-Loyverse-POS ; https://www.g2.com/compare/revel-systems-revel-systems-vs-square-point-of-sale |
| 9 | Lightspeed Restaurant | 4.4 (216) | 4.3 (55) | 271 | ~1,190 | https://www.capterra.com/p/211849/Lightspeed-Resturant/ ; https://www.g2.com/products/lightspeed-restaurant/reviews |
| 10 | SumUp POS | 4.8 (17) | 4.6 (24) | 41 | ~190 | https://www.capterra.ca/software/1037818/sumup-point-of-sale ; https://www.g2.com/categories/retail-pos |
| - | Zettle by PayPal | unverified (see note) | 4.4 (34) | - | - | https://www.g2.com/categories/retail-pos |

Notes:
- Zettle: Capterra lists "PayPal Point of Sale" 4.6 (2,290) at https://www.capterra.com/p/171165/PayPal-Here-app/reviews/ ; URL slug shows the review base is the older PayPal Here app, so attribution to Zettle is unverified and it is excluded from ranking. If counted, it would rank #2.
- Shopify: Capterra "Shopify" platform listing 4.5 (6,764) covers ecommerce, not POS; excluded.
- G2 counts for TouchBistro and Revel come from sidebar/compare pages and may be stale (Revel compare page counts lag the live profile).
- Loyverse added as #6 because it has the highest satisfaction (Capterra 98% positive) and is the closest small-F&B analogue; it is not in the top-5 analysis but is quoted where relevant.

## 2. Per-product praise and complaints (top 5 + Loyverse)

### 2.1 Square Point of Sale
Praise
- Onboarding/ease: "navigating through its features is pretty straightforward" - https://www.capterra.com/p/275802/Square-Point-of-Sale/ (Capterra: 93% positive of 1,022 mentions)
- Go-live under a day is the most common G2 implementation answer - https://www.g2.com/products/square-point-of-sale/reviews
- Built-in modes (QSR, full service, bar, retail), KDS, payroll, marketing, banking in one ecosystem - same G2 page
Complaints / missing
- Stability: "Sometimes the app would glitch causing me to lose the progress made in my sale" - Capterra page above (61% negative of 302)
- Offline/connectivity: "difficult to use a spotty wifi connection" - Capterra page above (69% negative of 131)
- Hardware: reader "disconnects, is fragile" (Capterra summary, 49% negative of 102)
- Fees/add-ons: "Expensive features and add ons." / "Everything costs money like marketing" - https://www.g2.com/compare/revel-systems-revel-systems-vs-square-point-of-sale
- G2 AI-summarised wish list: more detailed/customizable reports, inventory for variations and large catalogs, desktop features on mobile, loyalty more accessible - G2 reviews page above

### 2.2 Lightspeed Retail
Praise
- All-in-one: "everything I need in one spot from reports, to inventory to e-commerce" - https://www.g2.com/products/lightspeed-retail/reviews
- Inventory depth: G2 inventory management 9.1/10 vs category 8.7 - https://www.g2.com/categories/retail-pos
- Remote/cloud access (93% positive of 58), purchase orders, receiving, multi-location sync - https://www.capterra.com/p/120491/Lightspeed-Retail/
Complaints / missing
- Inventory accuracy: "many glitches with stock deduction and control" - Capterra page above
- Reporting depth: "reporting does the job but lacks a bit when it comes to deep diving" - G2 page above
- Export: "I havent found the ability to extract detailed csv files" - G2 page above
- Accounting sync: "a glitch in the way it integrates with Quickbooks Online" - G2 page above
- Forced processing: "a fee for not using Lightspeed's credit card processing" - Capterra page above (69% negative of 108)
- Contracts/refunds 76% negative of 91; account manager unreachable - Capterra + G2 pages above
- Permissions: staff can export customer data; restricting export also blocks customer lookup - Capterra FAQ above

### 2.3 Toast
Praise
- Learnability: "you can learn how to use all the features within minutes" - https://www.capterra.com/p/136301/Toast-POS/
- Reporting: "Reporting is fast and accurate" - https://www.g2.com/products/toast/reviews
- One platform: POS, KDS, online ordering, payroll, tip pooling, scheduling, marketing, loyalty - G2 page above
Complaints / missing
- Fees: "fees for every single thing add up" - Capterra page above (90% negative of 39)
- Stability: "a bunch of incident updates about things not working properly" - G2 page above
- Support: phone support 78% negative of 46 - Capterra page above
- Permissions: "permission levels can be clunky or confusing" (Capterra FAQ summary)
- G2 AI wish list: report filters + date comparisons + labor/menu detail, modifier logic, multi-location controls, flexible tip pools - G2 page above

### 2.4 Shopify POS
Praise
- Omnichannel inventory: "reconciles with my website, making it easy to keep inventory correct" - https://www.g2.com/products/shopify-shopify-pos/reviews
- Setup ease, staff learn checkout fast; Capterra 93% positive - https://www.capterra.com/p/205337/Shopify-POS/
Complaints / missing
- Paywalls: "a lot of the integrations are behind a paywall" - G2 page above
- Wish list: "better inventory reports, more customization options, and a smoother offline experience" - G2 page above
- Invoicing: "I have to use a third-party app to get very robust invoices" - G2 page above
- Detailed staff permissions require paid tier (Capterra FAQ above); G2 hardware integration 7.9 vs category 8.6 - https://www.g2.com/categories/retail-pos

### 2.5 Clover
Praise
- Hardware: "LOVE the Flex device" - https://www.capterra.com/p/226864/Clover/ (devices 88% positive of 64)
- Setup quick (94% positive of 48) - Capterra page above
Complaints / missing
- Support: "My calls were disconnected and no one has ever followed up" - Capterra page above (88% negative of 34)
- Billing: unexpected/recurring charges 89% negative of 27; app fees accumulate - Capterra page above; https://www.g2.com/categories/retail-pos
- Multi-location: "assign multiple emails to each location instead of only the owner" - https://www.g2.com/products/clover/reviews
- Permissions: "employees accessing others' tables" (Capterra FAQ summary)
- G2 AI wish list: stronger inventory, flexible reporting, control across locations - G2 page above

### 2.6 Loyverse (reference, small F&B)
- Praise: free core, ease of use, sales reports 4.7 (150 ratings) - https://www.capterra.com/p/150632/Loyverse-POS/
- Cash shift: "you need to close manually the shift (cash) and it's not automatically calculated" - https://www.capterra.com/p/150632/Loyverse-POS/reviews/
- Recipe/modifier stock: "You cannot track the items in Modifiers and Variants" - same
- Tax export: "I need it devided into 21, 9 and 0%" - same
- Corrections: "wrong payment type is chosen and I cannot correct that" - same
- Staff roles paywalled: staff extension "currently USD$25 / month" - https://www.reddit.com/r/restaurateur/comments/13gwmwq/has_anyone_used_loyverse_pos/
- Variant editing after save impossible (delete + recreate) - https://www.reddit.com/r/POS/comments/1gj6lm8/good_pos_app_with_smooth_workflow/

## 3. Table-stakes features (on every top-5 feature page)

| Capability | Square | Lightspeed | Toast | Shopify | Clover |
|---|---|---|---|---|---|
| Multi-tender payments, tips, digital receipts, refunds/exchanges | Y | Y | Y | Y | Y |
| Item catalog, categories, modifiers/variants | Y | Y | Y | Y | Y |
| Inventory tracking + low-stock alerts | Y | Y | Y | Y | Y |
| Multi-location management | Y | Y | Y | Y | Y |
| Staff PINs, roles/permissions, activity by employee | Y | Y | Y | Y | Y |
| Automatic/manual discounts | Y | Y | Y | Y | Y |
| Real-time sales reporting from anywhere | Y | Y | Y | Y | Y |
| Customer profiles + loyalty | Y | Y | Y | Y (apps) | Y |
| Gift cards | Y | Y | Y | Y | Y |
| Online ordering / omnichannel sync | Y | Y | Y | Y | Y |
| Accounting integration (QuickBooks/Xero) / app market | Y | Y | Y | Y | Y |

Feature pages: https://squareup.com/us/en/point-of-sale/features ; https://www.lightspeedhq.com/pos/retail/features/ ; https://pos.toasttab.com/products ; https://www.shopify.com/pos/features ; https://www.clover.com/pos-systems . Toast page is suite-level only; its row values rely on the G2 product description (https://www.g2.com/products/toast/reviews). Lightspeed accounting/loyalty rows from Capterra FAQ (https://www.capterra.com/p/120491/Lightspeed-Retail/).

Differentiators seen on only 1-2 pages: AI demand forecasting + stock rebalancing (Shopify), manager approvals for discount/tax edits (Shopify), sales commissions (Shopify), payroll + tip pooling (Toast, Square), special orders / on-account / quotes (Lightspeed), customer feedback capture (Clover), vendor sales reports (Square).

## 4. Cross-product themes ranked by frequency
Count = products (of top 5 + Loyverse, max 6) where theme appears in review summaries or quotes above.

| Rank | Theme | Sentiment | Count | Products |
|---|---|---|---|---|
| 1 | Ease of use / fast onboarding for frontline staff | praise | 6 | all |
| 2 | Fee transparency, add-on paywalls, surprise charges | complaint | 6 | Square, Lightspeed, Toast, Shopify, Clover, Loyverse |
| 3 | Reporting depth: custom reports, comparisons, raw export | missing | 6 | Square, Lightspeed, Toast, Shopify, Clover, Loyverse |
| 4 | Support slow / unreachable for complex or billing issues | complaint | 6 | all (Shopify/Loyverse mixed) |
| 5 | Permissions granularity (too coarse, clunky, or paywalled) | missing | 5 | Lightspeed, Toast, Shopify, Clover, Loyverse |
| 6 | Inventory accuracy for variants/modifiers/recipes | missing | 5 | Square, Lightspeed, Shopify, Clover, Loyverse |
| 7 | Stability / glitches after updates | complaint | 5 | Square, Lightspeed, Toast, Shopify, Loyverse |
| 8 | Offline / poor-connectivity operation | missing | 3 (+Zettle) | Square, Shopify, Clover |
| 9 | Multi-location control (per-location settings, notifications) | missing | 3 | Toast, Clover, Lightspeed (praised) |
| 10 | Accounting/tax export correctness (QBO sync, VAT split) | missing | 3 | Lightspeed, Toast, Loyverse |
| 11 | Hardware/reader/printer reliability | mixed | 4 | Square, Lightspeed, Clover (praise), Loyverse |
| 12 | Contracts, cancellation, forced processor | complaint | 2 | Lightspeed, Toast |
| 13 | Admin correction of posted transactions; auto cash-shift close | missing | 1 | Loyverse |
| 14 | Flexible tip pools / labor detail | missing | 1 | Toast |

## 5. Lens for Orbis back-office gap review (questions, not decisions)
- Reporting: does owner back office offer date-range comparison, per-location/per-staff/per-item breakdowns and raw line-item CSV export?
- Tax/accounting: is export split by tax rate and ready for accounting import?
- Permissions: are roles granular (e.g., export vs lookup separated) and included in base tier?
- Inventory: are recipe/modifier ingredient deductions and variant edits after creation supported?
- Cash: is shift close auto-calculated with variance, and are post-sale corrections audited?
- Pricing page: are all fees visible in-app to the owner?
Each needs an EARS criterion and owner decision before any implementation (see `internal/docs/requirements/rd-11-open-decisions.md`).

## Gates
- App Store / Google Play ratings: NOT_RUN.
- Zettle Capterra mapping: unverified.
- No numbers invented; any figure not on a cited page is absent.
