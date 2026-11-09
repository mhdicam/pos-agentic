# Frontend Implementation Contract
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## App surfaces
Landing/auth/signup; platform admin/support; tenant owner/brand/outlet manager; POS register/shift/offline; customer storefront; dispatcher desktop; courier mobile PWA; AI Inbox/CS/finance.

## UX implementation rules
- Keep route groups/access shells scoped; guards must be mirrored by API authorization.
- Reuse unified design system while allowing tenant storefront theming with published versions.
- Mobile first for POS/Courier; sticky action area, accessible tables and clear state chips.
- Every form has empty/loading/invalid/permission-denied/offline/retry states; use confirmation for high-risk actions.
- Storefront builder must live-preview draft hero/logo/trust indicators and section toggles inside device frame, but public data uses published version only.
- Offline POS interface visibly separates local pending/reconciled/conflict orders, and never conflates pending sync with paid online.
- Courier foreground GPS requires user consent; no promise of background location in PWA.

## Prototype boundary
`references/posverse_phase_2_2o_delivery_operations.html` is a single-file UX reference, **not** reusable production architecture. Route smoke passed 532/532 as scoped; real API, PWA install and full E2E remain pending.
