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

## Prototype v2 theme (2026-11-10, draft)
Status: draft for review — prototype styling only, not a production UI-package decision.
- **Light mode only.** `color-scheme: light`; no `prefers-color-scheme: dark` overrides. Dark mode is out of scope until UX sign-off.
- **Visual language:** shadcn/ui (zinc neutrals, `--radius: 0.625rem`, soft-tint badges, segmented tabs, centred dialog, bottom-right toast). The prototype stays plain JS (no React); only the look is adopted.
- **Build:** Tailwind CSS v4 CLI. Source `css/src/app.css` → output `css/app.css` (committed, so `index.html` still opens from `file://` with no CDN). Commands: `npm install`, then `npm run css` (or `npm run css:watch`).
- **Semantic tokens** (CSS variables on `:root`, exposed to Tailwind via `@theme inline`):

| Token | Use |
|---|---|
| `--background` / `--foreground` | page surface / body text |
| `--card` | cards, dialogs, inputs, sidebar |
| `--primary` / `--primary-hover` / `--primary-foreground` | Orbis blue actions, active nav text, chart bars |
| `--muted` / `--muted-foreground` | secondary surfaces, labels, helper text |
| `--accent` / `--accent-foreground` | active nav item, selected conversation |
| `--border` / `--input` / `--ring` | dividers / field borders / 3px focus ring |
| `--success`, `--warning`, `--destructive` (+ `-soft`) | state badges and alerts — always with text |

- **Component class map** (names unchanged so `CONTRACT.md` holds): `.btn` → Button (`-primary`, `-danger`, `-ghost`, `-sm`); `.card` → Card; `.chip-*` → Badge; `.tbl` → Table; `.fld` → Label + Input/Select/Textarea; `.tabs` → Tabs; `.mdl` → Dialog; `.toast` → Sonner-style toast; `.banner` → Alert; `.stat` → KPI card.
- Screens must not add inline `style=` or `<style>` blocks; add a class in `css/src/app.css` instead (only exception: data-driven sizes such as bar height or meter width).
- **Public landing** (`js/screens/landing.js`, `Orbis.landing`, `lp-*` classes): nav, hero with role entry, features, steps, pricing from seed `plans` (FR-13, labelled illustrative), trust, FAQ, final CTA, footer. Copy follows PRD v1.4.5 §01 value proposition; PRD KPIs are pilot targets and must not be shown as results. Preview card is labelled "Ilustrasi" (not live data).
- **Collapsed sidebar** (desktop ≥861px): header button or Ctrl/⌘+B toggles a 64px icon rail; labels stay in the DOM (visually hidden) and each item has a `title` tooltip. The choice is a per-viewer preference in `localStorage` (`orbis-side-mini`, guarded). Mobile keeps the slide-in drawer.
- **Cashier register** (`js/screens/x-register.js`, `rg-*` classes): full-screen route (`Orbis.screens.pos.fullscreen = true`), product tiles with colour initials (deterministic tone per name), category pills, order panel with member search, payment sheet and success screen. QRIS uses a decorative simulated code labelled as simulation. Toasts move to the top on the register so they never cover the pay button.
