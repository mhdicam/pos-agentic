# Sizing & Capacity Research
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Capacity assumptions (unapproved)
Choose representative merchants for one outlet, five outlets, 20 outlets; measure SKU count, shift transactions, device queue backlog, concurrent checkout, webhook volume, COD settlements and AI messages. Avoid asserted throughput without benchmarks.

## Required measurements
P95 online checkout latency; offline local mutation durability; sync throughput/time-to-catch-up; stock row contention; 99th-percentile webhook processing; route-change render and mobile performance; per-tenant storage and AI expense.

## Performance experiment template
Record device/OS/browser, catalog size, transaction fixtures, network shape, number of concurrent registers, repeat count, cold/warm states, expected/observed result, failure modes and trace ID. See `architecture/nfr.md`.
