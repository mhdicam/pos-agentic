---
name: orbis-devops
description: >-
  Use when deploying or operating Orbis Commerce on a server: Dockerized
  web/API/worker behind TLS Nginx on an Ubuntu pilot VM, PostgreSQL roles/RLS
  and migrations, Redis/BullMQ worker, private S3-compatible storage, secrets,
  health checks and alerts, backup/restore drills, offline POS incidents,
  financial incidents, support access and provider outages. Sub-skill of the
  `orbis` skill.
---

# orbis-devops

## Overview

Operational skill for **shipping and running Orbis Commerce**. Nothing is deployed yet: the runbook is a design
draft and no backup, restore or incident procedure has been tested. Always follow
`internal/docs/operations/runbook.md` as Source of Truth; this skill summarizes order, gotchas and safety rules.

## Required Reading

- Runbook: `internal/docs/operations/runbook.md`
- Stack and repo boundaries: `internal/docs/architecture/stack.md`
- NFR (SLO, DR, observability): `internal/docs/architecture/nfr.md`
- Security standard and threat model: `internal/docs/security/{security-standard,threat-model}.md`
- Tenant RLS: `internal/docs/adr/0002-tenant-rls.md` · offline POS: `internal/docs/adr/0003-offline-pos-p0.md`
- Platform approvals: `internal/docs/adr/0008-privileged-platform-approvals.md`

## Principles

- **Secrets never in the repo.** Env files gitignored, secret store in production; placeholders (`<DB_HOST>`, `<domain>`) in tracked docs.
- **Separate DB credentials** for app (RLS-enforced, no `BYPASSRLS`), migrations, and read-only.
- **TLS on every external connection**; encrypted backups and object storage; private buckets only.
- **No permanent superadmin tenant-access token**; support access is ticket → purpose/scope/expiry → second approver with MFA → audited session → expiry/revoke.
- **POS keeps selling when providers fail.** AI/WhatsApp/payment outage degrades to an actionable pending state; the unofficial channel can be disabled without stopping POS.

## Deploy (future pilot)

1. Provision Ubuntu VM, Docker, Nginx with TLS; managed or well-operated PostgreSQL, Redis, private S3-compatible storage.
2. Create DB roles (app/migration/read-only); verify app role cannot bypass RLS before first tenant.
3. Run reviewed migrations with a recorded rollback path; never `drop`/reset on a shared environment.
4. Deploy `apps/api`, `apps/worker`, `apps/web`; readiness checks for API, DB, Redis worker, object storage with explicit degraded states.
5. Run cross-tenant probe suite against the deployed environment before onboarding a tenant; record evidence (command, env, commit, result).

## Health & Alerts

Checkout errors, offline sync backlog/conflicts, webhook retries, courier assignment, COD discrepancy, AI credit budget, RLS violations, storage/DB saturation. Logs are structured, redacted, with correlation IDs.

## Incidents

- **Offline POS:** verify device grant/TTL and local pending orders first. Do **not** wipe/reinstall or rotate device keys before data preservation. Reconnect controlled, replay idempotent outbox, inspect conflict inbox, reconcile receipt count vs accepted server orders. Revocation of an already-offline device is bounded by TTL, not instant.
- **Financial:** freeze the affected workflow, preserve immutable ledger and provider event IDs, reconcile cash/COD/stock/points, issue auditable reversals. Never hand-edit closed shifts.

## Backup & Restore

Define RPO/RTO, schedule backups + PITR/WAL archival to a separate location, restore into a disposable environment, verify tenant isolation and pending offline reconciliation. Never mark a restore test passed without evidence.

## Do Not

- Do not commit hosts, IPs, tokens or credentials.
- Do not give the app DB role `BYPASSRLS` or set tenant context on a pooled connection globally.
- Do not hand-edit ledger, shift, COD or stock rows in production — use auditable reversals.
- Do not wipe an offline POS device that may hold pending transactions.
- Do not expose private buckets or long-lived download URLs.
- Do not claim an SLA, backup or restore result that has not been measured.
