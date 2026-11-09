# Scope principles
Status: draft (for review, not signed off)
Date: 2026-11-10

- **Docs are the Source of Truth.** `internal/docs/**` is updated in the same change that touches behavior; a draft doc is not authorization to implement.
- **Offline POS is P0, but only for cash.** Registered devices may queue cash transactions under a signed TTL policy; live payment gateways and global quotas always require online validation ([ADR-0003](../adr/0003-offline-pos-p0.md)).
- **Tenant isolation before features.** No slice ships before S0 cross-tenant API/DB/worker probes pass ([ADR-0002](../adr/0002-tenant-rls.md)).
- **Money and stock are movements, not totals.** Integer IDR, immutable and idempotent stock/payment/refund/points/COD movements ([ADR-0004](../adr/0004-sku-inventory-ledger.md), [ADR-0005](../adr/0005-financial-pricing-snapshot.md)).
- **Modular monolith first.** No microservices, Kafka or Kubernetes at MVP ([ADR-0001](../adr/0001-modular-monolith.md)).
- **AI assists, never mutates.** No direct SQL, refunds, price or stock changes by AI; provider secrets stay server-side ([ADR-0007](../adr/0007-channel-ai-adapters.md)).
- **Official channels first.** Unofficial WhatsApp is experimental, default off, explicit opt-in, gated by Legal/Security; no anti-detection behavior.
- **Courier location is foreground only** and requires consent; no background GPS promise in a PWA ([ADR-0010](../adr/0010-courier-location-cod.md)).
- **One tenant = one SaaS customer**, many brands and outlets; no inter-tenant courier fleet, wallet or split settlement at MVP.
- **Unsure? Record it** in [`rd-11-open-decisions.md`](../requirements/rd-11-open-decisions.md) instead of choosing silently.
