# Non-Functional Requirements (NFR)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Targets to sign and measure
- **Security:** tenant isolation verified at API + DB + worker/cache/export, MFA for privileged platform staff, safe OAuth/webhook/secret storage.
- **Durability:** local offline POS outbox survives restart and replay; zero duplicate server effects under retry.
- **Availability:** define SLOs by POS checkout, storefront and delivery; no invented SLA until performance baseline captured.
- **Performance:** define agreed p95 checkout/SKU search/offline sync, device target matrix and realistic load fixtures; publish benchmark environment/result.
- **UX:** responsive 320/390/768/1440px, no page overflow, WCAG 2.2 AA target, keyboard forms, accessible feedback, realistic scanner/printer flows.
- **Observability:** structured redacted logs, correlation IDs, device queue metrics, COD discrepancies, webhook retry and AI credit usage alerts.
- **DR:** propose RPO/RTO, verify restore and offline pending transaction reconciliation; never mark a backup test passed without evidence.
- **Privacy:** PII minimization, document/POD signed links, consent, retention, deletion procedure, export approval and logging.

## Evidence and gates
Benchmark protocol and negative tests documented under `qa/`; performance/reliability thresholds require SRE, Product and QA approval before coding freeze or production release.
