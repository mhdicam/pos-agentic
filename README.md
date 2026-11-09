# Orbis Commerce — Internal Documentation Scaffolding

> Status: **DRAFT FOR REVIEW — NOT SIGNED OFF**  
> Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff  
> Updated: 2026-11-03

This repository skeleton follows the **document organization** in the supplied `internal.zip`, adapted to Orbis Commerce rather than copying the unrelated Personal Cash Flow business rules.

Start at [`internal/docs/README.md`](internal/docs/README.md). Source requirement baselines and Phase 2.3 CSV evidence are included under [`internal/docs/references`](internal/docs/references) and [`internal/docs/handoff`](internal/docs/handoff).

**Scope:** document scaffolding and engineering handoff structure. This package **is not a runnable SaaS application, not an installed offline PWA, and not an approved engineering implementation**. No production credentials, approvals, or test execution were created by this archive.

## Quick start

1. Read `internal/docs/README.md` in its specified order.
2. Review decision register `internal/docs/requirements/rd-11-open-decisions.md` and the 26 source blockers.
3. Product/UX/Engineering/Security/QA/Finance stakeholders approve canonical contracts before implementation.
4. Treat all `/v1/*` endpoint names in domain files as **proposals** until OpenAPI is signed.
5. Keep FR IDs traceable to baseline and Phase 2.3 CSV; never imply route smoke equals business acceptance.
6. Run `python scripts/validate_docs.py` to check required scaffold files and relative links.

## Product direction preserved

Multi-tenant POS SaaS, white-label multi-brand storefront, SKU inventory/procurement, register/cash shift, expense/finance, membership/promotions, delivery courier/COD/POD, AI+CRM and multichannel integrations, Super Admin platform operations. **Offline POS is mandatory P0 in MVP.** Unofficial WhatsApp is experimental opt-in only.

## Proposed application structure (not generated runtime)

See `internal/docs/architecture/stack.md` for `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`, and `packages/ui` boundaries. Code implementation is intentionally not claimed in a document-only scaffold.
