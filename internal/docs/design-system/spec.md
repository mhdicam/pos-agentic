# Design System Specification — Orbis
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## UI principles
Readable, focused, enterprise-credible but approachable. Use restrained blue/neutral palette, compact density for operations, generous touch targets on POS/Courier; brand themes scoped to public storefront only.

## Components
App shell, role sidebar/bottom-nav, breadcrumb, tenant/outlet selector, table/filter/sort/export, currency input, SKU picker, register status, offline/sync badge, scanner feedback, payment allocator, member selector, approval decision, queue card, delivery timeline, POD uploader, financial variance, AI handoff, mobile frame preview.

## State vocabulary
`draft`, `pending`, `active`, `sync_pending`, `conflict`, `awaiting_approval`, `failed`, `reconciled`, `archived`; map to human-readable Indonesian copy and accessible icon/text, never color alone.

## Accessibility
WCAG 2.2 AA target; visible focus, labels/errors, keyboard trap/restore modal, correct contrast, screen-reader live announcements for pending/error, touch target evaluation and non-motion-dependent flows. Test actual devices/assistive technology before sign-off.

## Token governance
Theme tokens and brand overrides versioned. Define spacing/typography scales and components in shared UI package after UX sign-off; do not copy ad-hoc prototype inline styles blindly into production.
