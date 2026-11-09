# Operations Runbook — Design Draft
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Deployment (future)
Target pilot: Dockerized web/API/worker behind TLS Nginx on Ubuntu, managed or well-operated PostgreSQL, Redis and private S3-compatible storage. Separate secrets, deployment environments, backups, metrics and audit.

## Health checks
- Readiness for API, database, Redis worker and object storage, with explicit degraded dependencies.
- Alerts for checkout errors, offline sync backlog/conflict, webhook retry, courier assignment, COD discrepancy, AI credit budget, RLS violations and storage/DB saturation.

## Offline POS incident
1. Verify device authorization/TTL; determine whether local pending orders exist.
2. Do not wipe/reinstall or rotate device keys until data preservation/recovery plan is executed.
3. Reconnect in controlled mode, replay idempotent outbox, inspect conflict inbox and reconcile receipt count vs accepted server orders.
4. Revoke compromised devices; understand that already-offline device enforcement is bounded by TTL, not instant.

## Financial incident
Freeze affected workflow, preserve immutable ledger and provider event IDs, reconcile expected vs physical cash, COD remittance, stock and points; issue auditable reversal, never hand-edit closed shifts.

## Support access
Ticket → purpose/scope/expiry → second approver with MFA → session audit → expiry/revoke. No secret/PII downloads by default.

## Backup/restore
Define RPO/RTO and schedule, test restore into disposable environment, verify tenant isolation and pending offline reconciliation, record evidence and rollback; **not tested by this scaffold**.

## Provider outage
Fail safely with actionable pending status; official messaging follows provider policies; unofficial experimental channel can be disabled without stopping POS.
