# Project Brief — Orbis Commerce
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Problem
Small businesses often operate checkout, stock, expense reporting, branded online catalog, customer communication and delivery in disconnected tools. Connectivity failure blocks cash sales and reconciliation becomes manual. Multi-outlet ownership and tenant isolation add complexity.

## Users
Platform Super Admin, Platform Support, Tenant Owner, Brand Admin, Outlet Manager, Cashier, Dispatcher, Courier, AI Manager, CS/CRM Agent, Finance/Viewer, Customer/Guest.

## Deliverable and current evidence
- HTML Phase 2.2O: **interactive prototype**, using browser-local demo state.
- PRD v1.4.5 and Phase 2.3 handoff: **Draft for Review**.
- Route regression 532/532 (133 role-menu × four viewport sizes) passed **scoped smoke checks** only; 109 acceptance cases and 36 role journeys are specified but not fully executed.

## Value proposition
One tenant can operate many brands/outlets, grant least-privilege staff roles, customize storefront, run POS online/offline, manage inventory/expenses, ship via its couriers and enable optional AI/communication services.

## MVP/non-MVP boundaries
Core services listed in `requirements/prd.md`. Online provider settlement, production offline sync, live GPS, support access and accounting correctness remain engineering gates, not current runtime capabilities.

## Decision and owner
Product Owner, UX Lead, Engineering Lead, Security/Privacy Lead, QA Lead, Finance/Ops representative: **all sign-off pending**. Consult `requirements/rd-11-open-decisions.md`.
